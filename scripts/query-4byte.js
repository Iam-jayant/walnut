const https = require('https');

https.get('https://www.4byte.directory/api/v1/signatures/?hex_signature=0xd2251dd5', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    console.log(JSON.parse(data));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
