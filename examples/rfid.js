/*********************************************
This basic rfid example listens for an RFID
device to come within range of the module,
then logs its UID to the console.
*********************************************/

var tessel = require('tessel');
var rfid = require('../').use(tessel.port('A'));

rfid.on('ready', function (version) {
  console.log('Ready to read RFID card');

  rfid.on('read', function(uid) {
    console.log('UID:', uid);
  });
});
