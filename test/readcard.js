// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var portname = process.argv[2] || 'A';
console.log('# connecting to port', portname);

var tessel = require('tessel');
var rfid = require('../').use(tessel.port[portname]);

console.log('1..2');

rfid.on('ready', function (version) {
  console.log('# ready to read RFID card');
  console.log('ok')

  rfid.on('data', function(uid) {
  	console.log('# uid', uid);
    console.log(uid.length == 4 ? 'ok' : 'not ok', '- length of returned data');
    rfid.disable();
  });
});

rfid.on('error', function (err) {
  console.log('not ok', '-', err);
})
