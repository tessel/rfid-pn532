// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

/*********************************************
This example authorizes a mifare classic for 
read/write operations. First it will read a 
block of data off the card, write new data 
over the block, and then read back the data 
on the card to verify that the data on the 
card has changed.
*********************************************/

var tessel = require('tessel');
var rfidlib = require('../'); // Replace '../' with 'rfid-pn532' in your own code

var rfid = rfidlib.use(tessel.port['A'], {listen: false}); 


rfid.on('ready', function (version) {

  console.log('Ready to read RFID card');
  
  rfid.on('read', function(card) {
    console.log('Card found!');
    console.log('UID:', card.uid.toString('hex'));
    console.log("Start auth #1");


    var addr = 0x04; // Block address we will write to
    var auth_key = [0xff,0xff,0xff,0xff,0xff,0xff]; // Authentication key for data block
    var new_data = [0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xab,0xac,0xad,0xae,0xaf,0xff]; // New data to write to block
    var authType = 0; // Authorization type - 0 for A, 1 for B - A is the most common

    var afterAuth1 = function(err){
      if (err) {
        console.log("Auth error", err);
        rfid.startListening();
      } else {
        console.log("Read old data");
        rfid.mifareClassicReadBlock(addr, afterRead1) // Read the existing data in the block
      }
    };

    var afterRead1 = function(err, data){
      if (err) {
        console.log("Read error", err);
        rfid.startListening();
      } else {
        console.log("Old data", data);
        console.log("Start auth #2");
        rfid.mifareClassicAuthenticateBlock(card.uid,addr,authType,auth_key,afterAuth2); // Just in case the previous auth has timed out
      }
    };

    var afterAuth2 = function(err){
      if (err) {
        console.log("Auth error", err);
        rfid.startListening();
      } else {
        console.log('Write new data');
        rfid.mifareClassicWriteBlock(addr, new_data, afterWrite); // Write the new data to the block
      }
    };

    var afterWrite = function(err) {
      if (err){
        console.log("Write error", err);
        rfid.startListening();
      } else {
        console.log("Start auth #3");
        rfid.mifareClassicAuthenticateBlock(card.uid,addr,authType,auth_key,afterAuth3); // Just in case the previous auth has timed out
      }
    };

    var afterAuth3 = function(err){
      if (err){
        console.log("Auth error", err);
        rfid.startListening();
      } else {
        console.log("Read new data");
        rfid.mifareClassicReadBlock(addr, afterRead2); // Read back the new data we just wrote to the block
      }
    };

    var afterRead2 = function(err, data){
      if (err) {
        console.log("Read error", err);
        rfid.startListening();
      } else {
        console.log("New data", data);
        setTimeout(function() {
          rfid.startListening();
        }, 2500); // Wait 2.5 seconds and start listening for another card
      }
    };
       
    rfid.mifareClassicAuthenticateBlock(card.uid,addr,authType,auth_key,afterAuth1); // Authenticate our block for read/write operations

  });
});

rfid.on('error', function (err) {
  console.log(err);
});
