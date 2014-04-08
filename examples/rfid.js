var tessel = require('tessel');
console.log('Connecting...');
var rfid = require("../").connect(tessel.port("D"));

var time = 0;
var dt = 100;  // ms
setInterval(function(){time += dt/1000}, dt);

rfid.on('connected', function (version) {
  console.log("\n\n\t\tReady to read RFID card\n\n");

  // rfid.accessMem();

  rfid.on('data', function (uid) {
    var id = '';
    for (var i = 0; i < uid.length; i++) {
      id += ('0x' + (uid[i] < 16 ? '0' : '') + uid[i].toString(16) + ' ');
    }
    console.log('\nRead UID:\t', id, '\ntimestamp:', time, '\n');
  });
});