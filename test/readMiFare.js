// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var portname = process.argv[2] || 'A';
console.log('# connecting to port', portname);

var tessel = require('tessel');
var rfid = require('../').use(tessel.port[portname]);

console.log('1..2');



rfid.on('ready', function (version) {
  console.log('# ready to read RFID card');
  console.log('ok');
  rfid.on('read', function(card) {
    console.log('# uid:', card.uid);
    console.log("Auth #1");
    var addr = 0x04;
    rfid.setPollPeriod(1000*60*60, function(err) {
      rfid.classicAuthenticateBlock([0xca, 0x3d, 0x67, 0x4f],addr,0,[0xff,0xff,0xff,0xff,0xff,0xff], function(err, res){
        if (err) {
          console.log("Auth error", err);
          rfid.setPollPeriod(250);
        } else {
          console.log("Read #1");
          rfid.classicReadDataBlock(addr, function(err, res){
            if (err) {
              console.log("Read error", err);
              rfid.setPollPeriod(250);
            } else {
              console.log("Auth #2");
              rfid.classicAuthenticateBlock([0xca, 0x3d, 0x67, 0x4f],addr,0,[0xff,0xff,0xff,0xff,0xff,0xff], function(err, res){
                if (err) {
                  console.log("Auth error", err);
                  rfid.setPollPeriod(250);
                } else {
                  console.log('Write data');
                  rfid.classicWriteDataBlock(addr, [0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xab,0xac,0xad,0xae,0xaf,0xff], function(err, res) {
                    if (err){
                      console.log("Write error", err);
                      rfid.setPollPeriod(250);
                    } else {
                      console.log("Auth #3");
                      rfid.classicAuthenticateBlock([0xca, 0x3d, 0x67, 0x4f],addr,0,[0xff,0xff,0xff,0xff,0xff,0xff], function(err, res){
                        if (err){
                          console.log("Auth error", err);
                          rfid.setPollPeriod(250);
                        } else {
                          console.log("Read #2");
                          rfid.classicReadDataBlock(addr, function(err, res){
                            if (err) {
                              console.log("Read error", err);
                              rfid.setPollPeriod(250);
                            } else {
                              rfid.setPollPeriod(250);
                            }
                          });
                        }
                        
                        
                      });
                    }
                    
                    
                  });


                }

                

              });


            }
            
            

          });

        }

      });
         
    });
  });


});

rfid.on('error', function (err) {
  console.log('not ok', '-', err);
});
