// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var portname = process.argv[2] || 'A';
console.log('# connecting to port', portname);

var tessel = require('tessel');
var rfid = require('../').use(tessel.port[portname]);

console.log('1..2');

rfid.setPollPeriod(1000);

rfid.on('ready', function (version) {
  console.log('# ready to read RFID card');
  console.log('ok');

  rfid.on('read', function(card) {
    console.log('# uid:', card);
    rfid.desfireSelectApplication([0x90, 0x11, 0xF2], function(err){
      if (!err) {
        rfid.desfireGetFileSettings(0x7E);
      }
    });
  });
});

rfid.on('error', function (err) {
  console.log('not ok', '-', err);
});
