PIO & JOYCE WEDDING WEBSITE

Files:
- index.html : page content and section structure
- rsvp.html   : guest lookup and attendance selection page
- rsvp-config.js : URL for the Google Apps Script lookup endpoint
- Code.gs    : Google Apps Script code for looking up reservation groups
- style.css  : all website styling and responsive sizing
- script.js  : music toggle and RSVP form behavior
- src/images : place photo/image assets here

To test: open index.html in Chrome, Edge, Firefox, or Safari, or serve this folder over HTTP with `python -m http.server 8000` and visit `http://localhost:8000`. Internet is needed for Google Fonts.

Music note: use the “Turn sound on” button to play or pause the MP3 in `src/`. Music playback does not require an internet connection.

RSVP setup:
1. Open script.google.com and create a new Apps Script project.
2. Replace its code with the contents of Code.gs, then save.
3. Deploy it as a web app, execute it as your account, and allow access to anyone. Authorize the requested Google Sheets access.
4. Copy the deployed web app URL into `window.RSVP_API_URL` in rsvp-config.js.
5. Serve or host this site over HTTP/HTTPS and test a guest name from the sheet.

The script reads the guest-list tab with ID 11485890810 and expects a header row containing ID, Firstname, and Lastname. Each guest should have one row; guests sharing an ID appear in the same reservation. After every guest in the reservation has an attendance answer, guests can save their RSVP. The script rechecks the reservation and guest names against the guest list, then creates or updates a `Confirmed` tab with `Submitted At`, `Reservation ID`, `First Name`, `Last Name`, and `Attendance` columns in columns A–E. Returning guests see their saved answer and submission time when looking up their reservation. Redeploy the Apps Script web app after changing Code.gs so the save action and saved-response lookup are available on the live site. The public lookup and save endpoint can still be queried by people who know a guest's name or reservation ID.
