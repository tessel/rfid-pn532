/*********************************************
This basic RFID example listens for an RFID
device to come within range of the module,
then logs its UID to the console.
*********************************************/

// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var tessel = require('tessel');
var rfid = require('../').use(tessel.port('A')); // Replace '../' with 'rfid-pn532' in your own code

rfid.on('ready', function (version) {
  console.log('Ready to read RFID card');

  rfid.on('data', function(uid) {
    console.log('UID:', uid);
  });
});

rfid.on('eror', function (err) {
  console.log(err)
})
