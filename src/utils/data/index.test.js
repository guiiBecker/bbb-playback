import {
  getCurrentDataIndex,
  getFileType,
  getPollLabel,
} from '.';

it('gets current data index', () => {
  const data = [
    { timestamp: 1.0 },
    { timestamp: 2.0 },
  ];

  // Under
  expect(getCurrentDataIndex(data, 0.0)).toEqual(-1);

  // Bottom boundary
  expect(getCurrentDataIndex(data, 0.9)).toEqual(-1);
  expect(getCurrentDataIndex(data, 1.0)).toEqual(0);

  // Top boundary
  expect(getCurrentDataIndex(data, 2.0)).toEqual(1);
  expect(getCurrentDataIndex(data, 2.1)).toEqual(1);

  // Above
  expect(getCurrentDataIndex(data, 3.0)).toEqual(1);

  // Single
  expect(getCurrentDataIndex([{ timestamp: 1.0 }], 0.0)).toEqual(-1);
  expect(getCurrentDataIndex([{ timestamp: 1.0 }], 1.0)).toEqual(0);
  expect(getCurrentDataIndex([{ timestamp: 1.0 }], 2.0)).toEqual(0);

  const empty = [];
  expect(getCurrentDataIndex(empty, 0.0)).toEqual(-1);

  const object = { timestamp: 1.2 };
  expect(getCurrentDataIndex(object, 0.0)).toEqual(-1);

  const invalid = [{}];
  expect(getCurrentDataIndex(invalid, 0.0)).toEqual(-1);
});

it('gets file type', () => {
  const json = 'name.json'
  expect(getFileType(json)).toEqual('json');
  const svg = 'name.svg';
  expect(getFileType(svg)).toEqual('svg');
  const xml = 'name.xml';
  expect(getFileType(xml)).toEqual('xml');
  const html = 'name.html';
  expect(getFileType(html)).toEqual('html');
});

it('gets the locale id for a poll label', () => {
  expect(getPollLabel('Yes', 'YN')).toEqual('yes');
  expect(getPollLabel('No', 'YN')).toEqual('no');
  expect(getPollLabel('Other', 'YN')).toEqual(null);
  expect(getPollLabel('Yes', 'YNA')).toEqual('yes');
  expect(getPollLabel('No', 'YNA')).toEqual('no');
  expect(getPollLabel('Abstention', 'YNA')).toEqual('abstention');
  expect(getPollLabel('True', 'TF')).toEqual('true');
  expect(getPollLabel('False', 'TF')).toEqual('false');
  expect(getPollLabel('Other', 'TF')).toEqual(null);
  expect(getPollLabel('True', 'X')).toEqual(null);
});
