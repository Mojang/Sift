#!/usr/bin/env node
var util = require('./util')
var colors = require('colors')
var commander = require('commander')
var pjson = require('./package.json')
var config = util.loadConfig()

commander
	.version(pjson.version)
	.option('-r, --region <region>', 'Aws region')
	.option('-a --account <account>', 'Account name')
	.option('-l --list_accounts', 'List accounts')
	.option('-f --force_regions', 'Use specified region for all accounts regardless of configured regions')
	.parse(process.argv)

var force_regions = commander.force_regions || config.force_regions

var findServers = function (account, filters, callback) {
	require('./plugins/' + account.type).search(account, filters, function (servers) {
		callback(servers)
	})
}

var gatherServers = function (accounts, regions, filters) {
	var todo = []
	if (regions == null || regions.length < 1) {
		regions = []
		accounts.forEach(function (account) {
			account.regions.forEach(function (region) {
				if (!(regions.indexOf(region) > -1)) {
					regions.push(region)
				}
			})
		})
	}
	accounts.forEach(function (account) {
		if(!(config.search_plugins.indexOf(account.type) > -1)) {
			return console.log('Unknown type %s - ignoring account %s'.red, account.type, account.name)
		}
		if (force_regions) {
			account.regions = regions
		} else {
			account.regions = account.regions.filter(function filterRegions(region) {
				return regions.indexOf(region) > -1
			})
		}
		if (account.regions.length > 0) {
			todo.push(account)
			console.log('Using %s account %s (%s)' + (account.publicToken ? ' - %s' : '').green, colors.blue(account.type), colors.green(account.name), colors.yellow(account.regions), account.publicToken ? colors.red(account.publicToken) : '')
		}
	})

	todo.forEach(function (account) {
		findServers(account, filters, function callback(servers) {
			console.log(servers);
		})
	})
}

var parseArguments = function () {
	var regions = []
	var accounts = []
	if (commander.region) {
		regions = [commander.region]
	}
	if (commander.account) {
		var found = false
		accounts = config.credentials.filter(function (account) {
			return account.name == commander.account || account.publicToken == commander.account
		})
		if (accounts.length < 1) {
			return console.log('No accounts found with this name or public token'.red)
		}
	} else {
		if (config.credentials < 1) {
			return console.log('No accounts defined in config'.red)
		}
		gatherServers(config.credentials, regions)
	}
	gatherServers(accounts, regions)
}

//console.log(commander.args[0])

// Possibly read from shared credential store by AWS? http://blogs.aws.amazon.com/security/post/Tx3D6U6WSFGOK2H/A-New-and-Standardized-Way-to-Manage-Credentials-in-the-AWS-SDKs

if (commander.list_accounts) {
	config.credentials.forEach(function (account) {
		console.log('%s %s (%s)' + (account.publicToken ? ' - %s' : ''), account.name.green, account.type.blue, colors.yellow(account.regions), account.publicToken ? colors.red(account.publicToken) : '')
	})
	return
}

parseArguments()