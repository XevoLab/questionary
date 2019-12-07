/**
 * @Filename:     pdf.js
 * @Date:         Xevolab <francesco> @ 2019-12-06 11:14:12
 * @Last edit by: francesco
 * @Last edit at: 2019-12-07 19:48:38
 * @Copyright:    (c) 2019
 */


const express = require('express');
const router = express.Router();

require('dotenv').config();

const aws = require('aws-sdk');
var ddb = new aws.DynamoDB({apiVersion: '2012-08-10', region: process.env.AWS_REGION});

const ejs = require('ejs');
const fs = require('fs');
const pdf = require('html-pdf');

router.get("/:id", async (req, res) => {

	var params = {
		TableName: process.env.AWS_TABLE_NAME,
		ConsistentRead: true,
		Limit: 1,
		KeyConditionExpression: "ID = :val",
		ExpressionAttributeValues: {
			':val': {S: req.params.id}
		}
	};

	var ddbResponse = ddb.query(params).promise();

	var pollData = await ddbResponse.then((d) => {
		if (d.Items.length === 0) {
			res.render('pages/errors', {language: req.languageData.errors, uri: req.protocol + '://' + req.get('host') + '/', errorCode: 404});
			return;
		}
		var pollData = d.Items[0];

		function compare(a, b) {
			// Use toUpperCase() to ignore character casing
			const votesA = parseInt(a.M.votes.N);
			const votesB = parseInt(b.M.votes.N);

			let comparison = 0;
			if (votesA > votesB) {
				comparison = -1;
			} else if (votesA < votesB) {
				comparison = +1;
			}
			return comparison;
		}

		pollData.options.L = pollData.options.L.sort(compare);

		var totalVotes = pollData.options.L.reduce((ac, cv) => ac + parseInt(cv.M.votes.N), 0);

		var pageData = {
			id: req.params.id,
			title: pollData.title.S,
			collectNames: pollData.metadata.M.collectNames.BOOL,
			total: totalVotes,
			options: pollData.options.L,
			uri: req.get('host'),
		};

		return pageData;

	}).catch((err) => {
		console.error("DynamoDB error results.js : ", err);
		res.render('pages/errors', {language: req.languageData.errors, uri: req.protocol + '://' + req.get('host') + '/', errorCode: 500});
	})

	templateString = fs.readFileSync(require('path').resolve(__dirname, '../../views/pages/pdftemplate.ejs'), 'utf-8');
  html = ejs.render(templateString, pollData);

	pdf.create(html, {
		format: 'A4',
		orientation: 'portrait',
		border: {
			top: '5mm',
			left: '5mm',
			right: '5mm'
		},
		footer: {
			height: '15mm'
		}
	}).toStream(function(err, stream){
		res.setHeader('Content-type', 'application/pdf');
		stream.pipe(res);
	});
	return

});
router.get("/:id/export", async (req, res) => {

	console.log(res.render('pages/pdftemplate', pollData));

});

module.exports = router;
