/*jslint node: true */
'use strict';
const request = require('request');
const conf = require('byteballcore/conf.js');
const notifications = require('./notifications.js');

//require('request-debug')(request);

function sendRestRequest(url, onDone){
	let headers = {
		"Content-Type": "application/json",
		"User-Agent": "Byteball attestation/1.0"
	};
	request({
		url: url, 
		headers: headers, 
		method: 'GET', 
		auth: {
			user: conf.apiToken,
			pass: conf.apiSecret,
			sendImmediately: true
		}
	}, function (error, response, body){
		if (error || response.statusCode !== 200){
			notifications.notifyAdmin(url+" failed", error+", status="+(response ? response.statusCode : '?'));
			return onDone(url+" failed: "+error);
		}
		console.log("response: ", body);
		if (typeof body === 'string')
			body = JSON.parse(body);
		onDone(null, body);
	});
}

function retrieveScanData(jumioIdScanReference, onDone){
	console.log('retrieveScanData', jumioIdScanReference);
	sendRestRequest("https://lon.netverify.com/api/netverify/v2/scans/"+jumioIdScanReference, (err, body) => {
		console.log(err, body);
		if (err)
			return onDone();
		if (!body.status){
			notifications.notifyAdmin("no status", JSON.stringify(body));
			return onDone();
		}
		if (body.status === 'PENDING')
			return onDone();
		sendRestRequest("https://lon.netverify.com/api/netverify/v2/scans/"+jumioIdScanReference+"/data", (err, body) => {
			if (err)
				return onDone();
			onDone(body);
		});
	});
}

function initScan(user_address, scanReference, onDone){
//	let auth = "Basic " + new Buffer(conf.apiToken + ":" + conf.apiSecret).toString("base64");
	let headers = {
		"Content-Type": "application/json",
		"User-Agent": "Byteball attestation/1.0"
	};
	let json = {
		merchantIdScanReference: scanReference,
		customerId: user_address
	};
	request({
		url: "https://lon.netverify.com/api/netverify/v2/initiateNetverifyRedirect", 
		headers: headers, 
		method: 'POST', 
		json: json,
		auth: {
			user: conf.apiToken,
			pass: conf.apiSecret,
			sendImmediately: true
		}
	}, function (error, response, body){
		if (error || response.statusCode !== 200){
			notifications.notifyAdmin("init netverify failed", error+", status="+(response ? response.statusCode : '?'));
			return onDone("init netverify failed: "+error);
		}
		console.log("response: ", body);
		onDone(null, body.clientRedirectUrl, body.jumioIdScanReference, body.authorizationToken);
	});
}

function convertRestResponseToCallbackFormat(body){
	let data = {
		idScanStatus: body.transaction.status,
		verificationStatus: body.document.status,
		idFirstName: body.document.firstName,
		idLastName: body.document.lastName,
		idDob: body.document.dob,
		gender: body.document.gender,
		idCountry: body.document.issuingCountry,
		idUsState: body.document.usState,
		idNumber: body.document.number,
		idType: body.document.type,
		idSubtype: body.document.idSubtype,
		clientIp: body.transaction.clientIp
	};
	if (body.verification)
		data.identityVerification = body.verification.identityVerification;
	return data;
}

exports.initScan = initScan;
exports.retrieveScanData = retrieveScanData;
exports.convertRestResponseToCallbackFormat = convertRestResponseToCallbackFormat;

