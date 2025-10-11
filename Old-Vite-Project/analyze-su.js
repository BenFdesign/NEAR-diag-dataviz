// Analyze Su Data structure
import fs from 'fs';

console.log('=== Su Data Analysis ===');
const suData = JSON.parse(fs.readFileSync('./src/data/Su Data.json', 'utf8'));
console.log('Total entries:', suData.length);
suData.forEach(su => {
  console.log(`Su ${su.Su}: ID=${su.ID}, Bank ID=${su['Su Bank ID']}, Pop=${su['Pop Percentage']}%`);
});

console.log('\n=== Su Bank Analysis ===');
const suBank = JSON.parse(fs.readFileSync('./src/data/Su Bank.json', 'utf8'));
console.log('Total entries:', suBank.length);
suBank.forEach(su => {
  console.log(`Bank ID ${su.Id}: ${su['Name Fr']}`);
});

console.log('\n=== Testing the mapping ===');
// Test the mapping function from DpSuTitle
const getSuIdsFromSuNumbers = (suNumbers) => {
  return suNumbers.map(suNumber => {
    const suRecord = suData.find(su => su.Su === suNumber);
    return suRecord ? (typeof suRecord.ID === 'string' ? parseInt(suRecord.ID) : suRecord.ID) : suNumber + 476;
  });
};

const testSuNumbers = [1, 2, 3];
const mappedIds = getSuIdsFromSuNumbers(testSuNumbers);
console.log('Su Numbers [1,2,3] map to IDs:', mappedIds);

// Check if these IDs exist in Su Bank
mappedIds.forEach((id, index) => {
  const bankEntry = suBank.find(su => su.Id === id);
  console.log(`Su ${testSuNumbers[index]} (ID ${id}):`, bankEntry ? bankEntry['Name Fr'] : 'NOT FOUND');
});