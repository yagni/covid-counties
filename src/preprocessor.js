const https = require('https');

function downloadJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
            let data = '';

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                resolve(data);
            });

            }).on("error", (err) => {
                reject(err);
        });
    });
}

function readPopulations(fs) {
    const data = fs.readFileSync('data/population.csv', 'utf8');

    const rows = data.split('\n').slice(1);
    const countyPopulations = {};
    for (const row of rows) {
        const [state, county, population] = row.split('\t');
        countyPopulations[`${county} - ${state}`] = +population;
    }
    return countyPopulations;
}

async function main() {
    const data = await downloadJSON('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv');
    //console.log(data.length);

    const fs = require('fs');
    //fs.writeFile('data/nytimes_counties.csv', data, (err) => { if (err) console.log(err) });

    //const data = fs.readFileSync('data/nytimes_counties.csv', 'utf8');

    const rows = data.split('\n').slice(1);
    const counties = {};
    for (const row of rows) {
        const [, county, state] = row.split(',');
        const key = `${county} - ${state}`;
        counties[key] = (counties[key] || []);
        counties[key].push(row);
    }
/*
    writeCountyData(fs, counties);
    writeCounties(fs, counties);
*/
    writeAllCasesAsDailyNewMovingAverage(fs, counties);
}

main();

function writeCounties(fs, counties) {
    const countyPopulations = readPopulations(fs);
    const stateCounties = {};
    for (const fullCounty of Object.keys(counties)) {
        const [county, state] = fullCounty.split(' - ');
        stateCounties[state] = (stateCounties[state] || []);
        stateCounties[state].push({name: county, population: countyPopulations[fullCounty]});
    }
    for (const state in stateCounties)
        stateCounties[state].sort((a,b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0);
    fs.writeFile(`data/counties.json`, JSON.stringify(stateCounties), (err) => {
        if (err) console.log(err);
    });
}

function getRowsAsNewDailyCases(rows) {
    return rows.map((row, i) => {
        if (i === 0) return row;
        const CASES_INDEX = 4;
        const prevCases = rows[i - 1].split(',')[CASES_INDEX];
        const currentRowSplit = row.split(',');
        currentRowSplit[CASES_INDEX] = Math.max(0, currentRowSplit[CASES_INDEX] - prevCases);
        return currentRowSplit.join(',');
    });
}

function writeCountyData(fs, counties) {
    const header = 'date,county,state,fips,cases,deaths';
    fs.mkdirSync('data/counties');
    for (const county in counties) {
        counties[county].sort();
        const processedRows = getRowsAsNewDailyCases(counties[county]); // = counties[county] (uncomment to show cumulative cases)
        const countyData = [header].concat(processedRows).join('\n');
        fs.writeFile(`data/counties/${county}.json`, countyData, (err) => {
            if (err) console.log(err);
        });
    }
}

const CASES_INDEX = 4;

function writeAllCasesAsDailyNewMovingAverage(fs, counties) {
    let outRows = ['date,county,state,fips,cases,deaths'];
    for (const county in counties) {
        counties[county].sort();
        outRows = outRows.concat(movingAvg(getRowsAsSplitNewDailyCases(counties[county]), 6).map(row => row.join(',')));
    }
    fs.writeFile(`data/dailyNewCasesMovingAvg.csv`, outRows.join('\n'), (err) => {
        if (err) console.log(err);
    });
}

function getRowsAsSplitNewDailyCases(rows) {
    const splitRows = rows.map(row => row.split(','));
    return splitRows.map((row, i) => {
        const currentRow = Array.from(row);
        if (i > 0) {
            const prevCases = splitRows[i - 1][CASES_INDEX];
            currentRow[CASES_INDEX] = Math.max(0, +currentRow[CASES_INDEX] - prevCases);
        } else
            currentRow[CASES_INDEX] = +currentRow[CASES_INDEX];
        return currentRow;
    });
}

function movingAvg (rows, neighbors) {
    return rows.map((row, idx) => {
      let start = Math.max(0, idx - neighbors), end = idx;
      let subset = rows.slice(start, end + 1);
      let sum = subset.reduce((a,b) => a + b[CASES_INDEX], 0);
      const result = Array.from(row);
      result[CASES_INDEX] = sum / subset.length;
      return result;
    });
  }