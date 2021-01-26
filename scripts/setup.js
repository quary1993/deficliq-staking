const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

const command = process.argv[2];

const replaceInFile = function(file, toBeReplaced, replaceWith) {
    let data = fs.readFileSync(file, 'utf8');
    const result = data.replace(new RegExp(toBeReplaced, 'g'), replaceWith);
    fs.writeFileSync(file, result, 'utf8', function(ex) {
        if (err) {
            return console.log(ex);
        }
    });
};


fs.copyFileSync('./truffle-config.js.template', './truffle-config.js');

replaceInFile('./truffle-config.js','{{mnemonic}}',command)