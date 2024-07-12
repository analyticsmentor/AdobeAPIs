const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const request = require('request');
const XLSX = require('xlsx');
const os = require('os');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('form', {
    error: null,
    clientIdError: null,
    clientSecretError: null,
    formData: { clientId: '', clientSecret: '', reportSuiteList: [''] },
    workbooks: null
  });
});

app.post('/submit', (req, res) => {
  const { reportSuiteList, clientId, clientSecret } = req.body;

  const reportSuites = reportSuiteList;
  const CLIENT_ID = clientId;
  const CLIENT_SECRET = clientSecret;
  const SCOPES = 'openid,AdobeID,additional_info.projectedProductContext';

  const makeRequest = (options) => new Promise((resolve, reject) => {
    request(options, (error, response, body) => {
      if (error) 
        return reject(error);
      if (response.statusCode >= 400) {
        const errorMessage = JSON.parse(response.body).error_description || 'An error occurred';
        return reject(new Error(errorMessage));
      }
      resolve(response);
    });
  });

  const getVars = (method, accessToken) => ({
    method: 'POST',
    url: `https://api.omniture.com/admin/1.4/rest/?method=ReportSuite.${method}`,
    headers: {
      'x-api-key': CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ "rsid_list": reportSuites })
  });

  const getTokenOptions = {
    method: 'POST',
    url: 'https://ims-na1.adobelogin.com/ims/token/v3',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      'grant_type': 'client_credentials',
      'client_id': CLIENT_ID,
      'client_secret': CLIENT_SECRET,
      'scope': SCOPES
    }
  };

  makeRequest(getTokenOptions)
    .then(response => {
      const accessToken = JSON.parse(response.body).access_token;

      const eVarsPromise = makeRequest(getVars("GetEvars", accessToken));
      const propsPromise = makeRequest(getVars("GetProps", accessToken));
      const eventsPromise = makeRequest(getVars("GetEvents", accessToken));
      const listVarsPromise = makeRequest(getVars("GetListVariables", accessToken));

      return Promise.all([eVarsPromise, propsPromise, eventsPromise, listVarsPromise]);
    })
    .then(responses => {
      const processData = (data, transform, fields) => {
        const transformedData = data.filter(item => item.enabled !== false).map(transform);
        if (transformedData.length <= 1) {
          transformedData.push({'Name':'No variable/event of this type is enabled..'});
        }
        return XLSX.utils.json_to_sheet(transformedData, { header: fields });
      };

      const transformEvars = item => ({
        'eVar Id': item.id,
        'Name': item.name,
        'Description': item.description,
        'Type': item.type,
        'Expiration type': item.expiration_type === 'day' ? `custom - ${item.expiration_custom_days} days` : item.expiration_type,
        'Allocation': item.allocation_type,
        'Merch. Syntax': item.merchandising_syntax,
        'Merch. Binding Events': String(item.binding_events || '')
      });
      const transformProps = item => ({
        'prop Id': item.id,
        'Name': item.name,
        'Description': item.description,
        'Is Pathing Enabled?': item.pathing_enabled,
        'Is List Enabled?': item.list_enabled,
        'Is Participation Enabled?': item.participation_enabled
      });
      const transformEvents = item => ({
        'event Id': item.id,
        'Name': item.name,
        'Description': item.description,
        'Type': item.type,
        'Serialization Type': item.serialization,
        'Is Participation?': item.participation !== 'disabled'
      });
      const transformListVars = item => ({
        'listVar Id': item.id,
        'Name': item.name,
        'Description': item.description,
        'Expiration type': item.expiration_type === 'day' ? `custom - ${item.expiration_custom_days} days` : item.expiration_type,
        'Allocation': item.allocation_type,
        'Delimiter': item.value_delimiter,
        'Item Max Values': item.max_values
      });

      const eVarFields = ['eVar Id', 'Name', 'Description', 'Type', 'Expiration type', 'Allocation', 'Merch. Syntax', 'Merch. Binding Events'];
      const propFields = ['prop Id', 'Name', 'Description', 'Is Pathing Enabled?', 'Is List Enabled?', 'Is Participation Enabled?'];
      const eventFields = ['event Id', 'Name', 'Description', 'Type', 'Serialization Type', 'Is Participation?'];
      const listFields = ['listVar Id', 'Name', 'Description', 'Expiration type', 'Allocation', 'Delimiter', 'Item Max Values'];

      const workbooks = reportSuites.map((rsid, i) => {
        const eVarWorksheet = processData(JSON.parse(responses[0].body)[i].evars, transformEvars, eVarFields);
        const propWorksheet = processData(JSON.parse(responses[1].body)[i].props, transformProps, propFields);
        const eventWorksheet = processData(JSON.parse(responses[2].body)[i].events, transformEvents, eventFields);
        const listWorksheet = processData(JSON.parse(responses[3].body)[i].list_variables, transformListVars, listFields);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, eVarWorksheet, 'eVars');
        XLSX.utils.book_append_sheet(workbook, propWorksheet, 'props');
        XLSX.utils.book_append_sheet(workbook, eventWorksheet, 'events');
        XLSX.utils.book_append_sheet(workbook, listWorksheet, 'listVars');

        return {
          rsid: rsid,
          workbook: workbook
        };
      });

      // Function to get the Downloads directory path
      function getDownloadsFolder() {
          const homeDir = os.homedir();
          return path.join(homeDir, 'Downloads');
      }
      
      // Save each workbook to the Downloads folder
      const downloadsFolder = getDownloadsFolder();
      workbooks.forEach(({ rsid, workbook }) => {
          const filePath = path.join(downloadsFolder, `AA Vars 4 ${rsid}.xlsx`);
          XLSX.writeFile(workbook, filePath);
          console.log(`Workbook saved to: ${filePath}`);
      });

      res.render('form', {
        error: null,
        clientIdError: null,
        clientSecretError: null,
        formData: { clientId, clientSecret, reportSuiteList },
        workbooks: workbooks.map(wb => `AA Vars 4 ${wb.rsid}.xlsx`) 
      });
    })
    .catch(error => {
      console.error('Error:', error.message);

      let errorMessage = error.message;
      let clientIdError = null;
      let clientSecretError = null;

      if (errorMessage.includes('client_id')) {
        clientIdError = errorMessage;
      }

      if (errorMessage.includes('client_secret')) {
        clientSecretError = errorMessage;
      }

      res.render('form', {
        error: errorMessage,
        clientIdError,
        clientSecretError,
        formData: { clientId, clientSecret, reportSuiteList },
        workbooks: null
      });
    });
});

// Endpoint to download files
app.get('/download', (req, res) => {
    const filePath = req.query.path;
    if (fs.existsSync(filePath)) {
      res.download(filePath, err => {
        if (err) {
          res.status(500).send('Error downloading file.');
        } else {
          // Optionally delete the file after download
          fs.unlinkSync(filePath);
        }
      });
    } else {
      res.status(404).send('File not found.');
    }
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
