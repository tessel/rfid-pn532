// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var portname = process.argv[2] || 'A';
var test = require('tinytap');
var async = require('async');
var tessel = require('tessel');
var rfidLib = require('../')
var rfid;

test.count(7);

async.series([
  test("Connecting to RFID card on correct port", function(t) {
    rfidLib.use(tessel.port[portname], {read: true, delay: 0}, function(err, r) {
      t.equal(err, null, "there is no error on creation in callback");
      rfid = r;
      var timeout = setTimeout(function() {
        t.fail("Ready event not fired.");
      }, 1000);
      rfid.on('ready', function() {
        clearTimeout(timeout);
        t.ok(true, true, "RFID ready event is called");
        t.end();
      })
    });
  }),

  test("Basic Reading", function(t) {
    var timeout = setTimeout(function() {
      t.fail("No RFID Card read.");
    }, 1000);
    rfid.once("read", function(data) {
      clearTimeout(timeout);
      t.equal(typeof data, 'object', "Argument on read event is an object");
      t.equal(Buffer.isBuffer(data.uid), true, "Provided data returns a Buffer UID");
      t.end();
    });
  }),

  test("Change RFID Polling Period", function(t) {
    var newPeriod = 2000;

    rfid.setPollPeriod(newPeriod, function(err){
      t.equal(err, null, "Error thrown on setting poll period with valid number");

      var i = 0;
      var first;
      var timeout;
      rfid.on('data', function(data) {
        i++;
        if (i === 1) {
          first = new Date();
        }
        else if (i === 2) {
          clearTimeout(timeout);
          rfid.removeAllListeners('data');
          var time = new Date() - first;
          t.equal(time > newPeriod, true, "Period not changed to be greater");
          var proportionOver = Math.abs(time-newPeriod)/newPeriod;
          t.equal(proportionOver < 0.2 , true, "Period is way over requested");
          t.end();
        }
      });

      timeout = setTimeout(function() {
        t.fail("Data events not hit after poll period changed.");
      }, newPeriod * 2)
    })

  })
  ]
)
