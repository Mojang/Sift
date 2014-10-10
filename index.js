#!/usr/bin/env node
var util = require('./util');
var colors = require('colors');
var commander = require('commander');
var pjson = require('./package.json');
var config = util.loadConfig();

commander
	.version(pjson.version)
	.option('-r, --region <region>', 'Aws region')
	.option('-a --account <account>', 'Account name')
	.parse(process.argv)

//console.log(commander.args[0]);

// Possibly read from shared credential store by AWS? http://blogs.aws.amazon.com/security/post/Tx3D6U6WSFGOK2H/A-New-and-Standardized-Way-to-Manage-Credentials-in-the-AWS-SDKs

var params = {
  Filters: [
    {
			Name: 'instance-state-name',
      Values: [
        'running',
      ]
    }
  ]
};

if (!commander.account) {
	for (var i in config.ec2_credentials) {
		var item = config.ec2_credentials[i];
		var aws = require('aws-sdk');
		aws.config.update({ accessKeyId: item.accessKeyId, secretAccessKey: item.secretAccessKey });
		if (!commander.region) {
			for (var region in item.regions) {
				var ec2 = new aws.EC2({ region: item.regions[region] });
				ec2.describeInstances(params, function(err, data) {
				  if (err) console.log(err, err.stack); // an error occurred
				  else     console.log(data.Reservations[0].Instances[0].Placement.AvailabilityZone);           // successful response
				});
			}
		} else {
			var ec2 = new aws.EC2({ region: commander.region });
			ec2.describeInstances(params, function(err, data) {
			  if (err) console.log(err, err.stack); // an error occurred
			  else     console.log(data.Reservations[0].Instances[0].Placement.AvailabilityZone);           // successful response
			});
		}
	}
} else {
	var found = false;
	for (var i in config.ec2_credentials) {
		var item = config.ec2_credentials[i];
		if (item.name == commander.account) {
			found = item;
			break;
		}
	}
	if (!found) {
		return console.log('There is no account with this name');
	}
	var aws = require('aws-sdk');
	aws.config.update({ accessKeyId: found.accessKeyId, secretAccessKey: found.secretAccessKey });
	if (!commander.region) {
		for (var region in found.regions) {
			var ec2 = new aws.EC2({ region: found.regions[region] });
			ec2.describeInstances(params, function(err, data) {
			  if (err) console.log(err, err.stack); // an error occurred
			  else     console.log(data.Reservations[0].Instances[0].Placement.AvailabilityZone);           // successful response
			});
		}
	} else {
		var ec2 = new aws.EC2({ region: commander.region });
		ec2.describeInstances(params, function(err, data) {
		  if (err) console.log(err, err.stack); // an error occurred
		  else     console.log(data.Reservations[0].Instances[0].Placement.AvailabilityZone);           // successful response
		});
	}
}