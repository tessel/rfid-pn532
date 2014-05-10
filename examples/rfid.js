var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").use(tessel.port("A"));

var time = 0;
var dt = 100;
setInterval(function () { time += dt / 1000 }, dt);

var printUID = function(uid) {
  if (uid) {
    var id = '';
    //  Format the UID nicely
    for (var i = 0; i < uid.length; i++) {
      id += ('0x' + (uid[i] < 16 ? '0' : '') + uid[i].toString(16) + ' ');
    }
    console.log('Read UID:\t', id, '\ntimestamp:', time, '\n');
  }
}

rfid.on('ready', function (version) {
  console.log("\n\t\tReady to read RFID card\n");

  //  One way
  rfid.setListening();
  rfid.on('rfid-uid', function(uid) {
    printUID(uid);
  });

  // //  Another way
  // setInterval(function() {
  //   rfid.readPassiveTargetID(0, function(err, uid) {
  //     printUID(uid);
  //   });
  // }, 500);
});
