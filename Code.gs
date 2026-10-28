const SPREADSHEET_ID = '1H2atjyxqvUL90kZKcmMpjm8_Hhforl-hlzbr9yQSSGw';
const GUEST_SHEET_GID = 1148589081;

function doGet(e) {
  const callback = String(e.parameter.callback || '');
  if (!/^rsvpLookup_[A-Za-z0-9_]+$/.test(callback)) {
    throw new Error('Invalid callback.');
  }

  if (e.parameter.action === 'save') {
    try {
      return saveConfirmations(e.parameter, callback);
    } catch (error) {
      console.error('Could not save RSVP confirmations:', error);
      return jsonp(callback, {
        ok: false,
        error: 'Could not save your RSVP: ' + error.message
      });
    }
  }

  const firstName = normalizeName(e.parameter.first);
  const lastName = normalizeName(e.parameter.last);
  if (!firstName || !lastName) {
    return jsonp(callback, { ok: false, error: 'Enter both your first and last name.' });
  }

  const sheet = getGuestSheet();
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length < 2) {
    return jsonp(callback, { ok: false, error: 'The guest list is empty.' });
  }

  const columns = getGuestColumns(rows[0]);
  const matchingRows = rows.slice(1).filter(row =>
    normalizeName(row[columns.first]) === firstName &&
    normalizeName(row[columns.last]) === lastName
  );
  const reservationIds = [...new Set(matchingRows.map(row => String(row[columns.id]).trim()))];
  if (!matchingRows.length) {
    return jsonp(callback, { ok: false, error: 'We could not find a reservation with that name. Check the spelling and try again.' });
  }
  if (reservationIds.length !== 1) {
    return jsonp(callback, { ok: false, error: 'More than one reservation matched. Please contact the couple for help.' });
  }

  const reservationId = reservationIds[0];
  const reservationRows = reservationId
    ? rows.slice(1).filter(row => String(row[columns.id]).trim() === reservationId)
    : matchingRows;
  const guests = reservationRows
    .filter(row => row[columns.first] && row[columns.last])
    .map(row => ({
      firstName: String(row[columns.first]).trim(),
      lastName: String(row[columns.last]).trim()
    }));
  const confirmations = getReservationConfirmations(reservationId);

  return jsonp(callback, {
    ok: true,
    reservationId: reservationId,
    guestCount: guests.length,
    guests: guests,
    confirmations: confirmations
  });
}

function getGuestSheet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
    .getSheets()
    .find(candidate => candidate.getSheetId() === GUEST_SHEET_GID);
  if (!sheet) {
    throw new Error('Could not find the configured guest-list sheet tab.');
  }
  return sheet;
}

function getGuestColumns(headerRow) {
  const headers = headerRow.map(header => String(header).trim().toLowerCase());
  const columns = {
    id: headers.indexOf('id'),
    first: headers.indexOf('firstname'),
    last: headers.indexOf('lastname')
  };
  if (Object.values(columns).some(column => column === -1)) {
    throw new Error('The guest-list tab needs ID, Firstname, and Lastname columns.');
  }
  return columns;
}

function getReservationConfirmations(reservationId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Confirmed');
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const rows = sheet.getDataRange().getDisplayValues();
  const headers = rows[0].map(header => String(header).trim().toLowerCase());
  const reservationColumn = headers.indexOf('reservation id');
  const firstColumn = headers.indexOf('first name');
  const lastColumn = headers.indexOf('last name');
  const attendanceColumn = headers.indexOf('attendance');
  const submittedColumn = headers.indexOf('submitted at');
  if ([reservationColumn, firstColumn, lastColumn, attendanceColumn, submittedColumn].some(column => column === -1)) {
    throw new Error('The Confirmed sheet needs Submitted At, Reservation ID, First Name, Last Name, and Attendance columns.');
  }

  return rows.slice(1)
    .filter(row => String(row[reservationColumn]).trim() === reservationId)
    .map(row => ({
      firstName: String(row[firstColumn]).trim(),
      lastName: String(row[lastColumn]).trim(),
      attendance: String(row[attendanceColumn]).trim(),
      submittedAt: String(row[submittedColumn]).trim()
    }));
}

function saveConfirmations(parameters, callback) {
  const reservationId = String(parameters.reservationId || '').trim();
  let responses;
  try {
    responses = JSON.parse(parameters.responses || '');
  } catch (error) {
    return jsonp(callback, { ok: false, error: 'The RSVP answers could not be read. Please try again.' });
  }

  if (!reservationId || !Array.isArray(responses) || responses.length === 0) {
    return jsonp(callback, { ok: false, error: 'The reservation or RSVP answers are missing.' });
  }

  const guestSheet = getGuestSheet();
  const guestRows = guestSheet.getDataRange().getDisplayValues();
  if (guestRows.length < 2) {
    return jsonp(callback, { ok: false, error: 'The guest list is empty.' });
  }

  const columns = getGuestColumns(guestRows[0]);
  const reservationGuests = guestRows.slice(1)
    .filter(row => String(row[columns.id]).trim() === reservationId && row[columns.first] && row[columns.last])
    .map(row => ({
      firstName: String(row[columns.first]).trim(),
      lastName: String(row[columns.last]).trim()
    }));

  if (reservationGuests.length !== responses.length) {
    return jsonp(callback, { ok: false, error: 'The RSVP answers do not match this reservation. Please search again.' });
  }

  const normalizedResponses = new Map();
  for (const response of responses) {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return jsonp(callback, { ok: false, error: 'One or more RSVP answers are invalid. Please check your selections.' });
    }
    const firstName = String(response.firstName || '').trim();
    const lastName = String(response.lastName || '').trim();
    const attendance = String(response.attendance || '');
    const key = normalizeName(firstName) + '|' + normalizeName(lastName);
    if (!firstName || !lastName || !['attending', 'not-attending'].includes(attendance) || normalizedResponses.has(key)) {
      return jsonp(callback, { ok: false, error: 'One or more RSVP answers are invalid. Please check your selections.' });
    }
    normalizedResponses.set(key, { firstName, lastName, attendance });
  }

  const reservationKeys = new Set(reservationGuests.map(guest =>
    normalizeName(guest.firstName) + '|' + normalizeName(guest.lastName)
  ));
  if (normalizedResponses.size !== reservationKeys.size ||
      [...normalizedResponses.keys()].some(key => !reservationKeys.has(key))) {
    return jsonp(callback, { ok: false, error: 'The RSVP answers do not match this reservation. Please search again.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let confirmationSheet = spreadsheet.getSheetByName('Confirmed');
    if (!confirmationSheet) {
      confirmationSheet = spreadsheet.insertSheet('Confirmed');
    }

    const expectedHeaders = ['Submitted At', 'Reservation ID', 'First Name', 'Last Name', 'Attendance'];
    if (confirmationSheet.getLastRow() === 0) {
      confirmationSheet.appendRow(expectedHeaders);
    } else {
      const actualHeaders = confirmationSheet.getRange(1, 1, 1, expectedHeaders.length).getDisplayValues()[0];
      if (expectedHeaders.some((header, index) => actualHeaders[index] !== header)) {
        throw new Error('The Confirmed sheet must use these headers in columns A-E: ' + expectedHeaders.join(', '));
      }
    }

    const existingRows = confirmationSheet.getLastRow() > 1
      ? confirmationSheet.getRange(2, 1, confirmationSheet.getLastRow() - 1, expectedHeaders.length).getDisplayValues()
      : [];
    const existingRowByGuest = new Map();
    existingRows.forEach((row, index) => {
      if (String(row[1]).trim() === reservationId) {
        existingRowByGuest.set(normalizeName(row[2]) + '|' + normalizeName(row[3]), index + 2);
      }
    });

    const submittedAt = new Date();
    normalizedResponses.forEach((response, key) => {
      const values = [[submittedAt, reservationId, response.firstName, response.lastName, response.attendance]];
      const existingRow = existingRowByGuest.get(key);
      if (existingRow) {
        confirmationSheet.getRange(existingRow, 1, 1, expectedHeaders.length).setValues(values);
      } else {
        confirmationSheet.appendRow(values[0]);
      }
    });
    confirmationSheet.getRange(2, 1, confirmationSheet.getLastRow() - 1, 1)
      .setNumberFormat('yyyy-mm-dd hh:mm:ss');
  } finally {
    lock.releaseLock();
  }

  return jsonp(callback, { ok: true, message: 'Your RSVP has been saved. Thank you!' });
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function jsonp(callback, payload) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
