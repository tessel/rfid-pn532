var tessel = require('tessel');
var rfid = require("../").use(tessel.port("A"));

rfid.on('ready', function (version) {
  console.log("Ready to read RFID card");

  rfid.on('read', function(uid) {
    console.log('UID:', uid);
  });
});
