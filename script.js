// Pio & Joyce Wedding Website interactions
(() => {
  const musicAudio = document.getElementById('musicAudio');
  const musicToggle = document.getElementById('musicToggle');
  let musicReady = false;

  function setMusicReady() {
    if (musicReady) return;
    musicReady = true;
    musicToggle.disabled = false;
  }

  function setMusicUnavailable(message) {
    if (!musicToggle) return;
    musicToggle.disabled = true;
    musicToggle.textContent = '♫ Song unavailable';
    musicToggle.setAttribute('aria-pressed', 'false');
    musicToggle.title = message;
  }

  if (musicAudio && musicToggle) {
    musicAudio.addEventListener('loadedmetadata', setMusicReady);

    musicAudio.addEventListener('play', () => {
      musicToggle.textContent = '♫ Turn sound off';
      musicToggle.setAttribute('aria-label', 'Turn sound off');
      musicToggle.setAttribute('aria-pressed', 'true');
    });

    musicAudio.addEventListener('pause', () => {
      musicToggle.textContent = '♫ Turn sound on';
      musicToggle.setAttribute('aria-label', 'Turn sound on');
      musicToggle.setAttribute('aria-pressed', 'false');
    });

    musicAudio.addEventListener('error', () => {
      setMusicUnavailable('Could not load the music file from the src folder.');
    });

    if (musicAudio.error) {
      setMusicUnavailable('Could not load the music file from the src folder.');
    } else if (musicAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      setMusicReady();
    }
  }

  if (musicToggle) {
    musicToggle.addEventListener('click', async () => {
      if (!musicReady) return;
      if (!musicAudio.paused) {
        musicAudio.pause();
        return;
      }

      try {
        await musicAudio.play();
      } catch (error) {
        musicToggle.title = 'Playback could not start. Please try again.';
        console.error('Could not start wedding song playback:', error);
      }
    });
  }

  const rsvpLookupForm = document.getElementById('rsvpLookupForm');
  if (rsvpLookupForm) {
    const searchStatus = document.getElementById('searchStatus');
    const reservationResult = document.getElementById('reservationResult');
    const submitButton = rsvpLookupForm.querySelector('button[type="submit"]');

    function requestApi(parameters) {
      return new Promise((resolve, reject) => {
        const apiUrl = window.RSVP_API_URL;
        if (!apiUrl) {
          reject(new Error('The RSVP service has not been configured yet.'));
          return;
        }

        const callbackName = 'rsvpLookup_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const requestUrl = new URL(apiUrl);
        requestUrl.searchParams.set('callback', callbackName);
        Object.entries(parameters).forEach(([key, value]) => requestUrl.searchParams.set(key, value));

        const requestScript = document.createElement('script');
        let timeoutId;
        const cleanup = () => {
          window.clearTimeout(timeoutId);
          delete window[callbackName];
          requestScript.remove();
        };

        window[callbackName] = response => {
          cleanup();
          resolve(response);
        };
        requestScript.onerror = () => {
          cleanup();
          reject(new Error('Could not connect to the RSVP service. Please try again later.'));
        };
        timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error('The guest list took too long to respond. Please try again.'));
        }, 15000);
        requestScript.src = requestUrl.toString();
        document.head.appendChild(requestScript);
      });
    }

    function lookupReservation(firstName, lastName) {
      return requestApi({ first: firstName, last: lastName });
    }

    function saveReservation(reservation, responses) {
      return requestApi({
        action: 'save',
        reservationId: reservation.reservationId,
        responses: JSON.stringify(responses)
      });
    }

    function renderReservation(reservation, firstName, lastName) {
      if (!reservation || !Array.isArray(reservation.guests) || reservation.guests.length === 0) {
        throw new Error('The guest list returned an invalid reservation.');
      }

      const guestCount = reservation.guests.length;
      const summary = document.createElement('div');
      summary.className = 'reservation-summary';

      const coupleMessage = document.createElement('p');
      coupleMessage.className = 'reservation-couple';
      coupleMessage.textContent = 'Pio & Joyce are excited to celebrate with';
      summary.appendChild(coupleMessage);

      const guestHeading = document.createElement('h2');
      guestHeading.className = 'reservation-name serif';
      guestHeading.textContent = firstName + ' ' + lastName + (guestCount > 1 ? ' & FAMILY' : '');
      summary.appendChild(guestHeading);

      const reservedMessage = document.createElement('p');
      reservedMessage.className = 'reservation-lead';
      reservedMessage.textContent = 'We have reserved ' + guestCount + (guestCount === 1 ? ' seat' : ' seats') + ' in your honor.';
      summary.appendChild(reservedMessage);

      const count = document.createElement('div');
      count.className = 'reservation-count';
      count.textContent = String(guestCount);
      summary.appendChild(count);

      const countLabel = document.createElement('p');
      countLabel.className = 'reservation-count-label';
      countLabel.textContent = 'Reserved seats';
      summary.appendChild(countLabel);

      const includedNote = document.createElement('p');
      includedNote.className = 'reservation-note';
      includedNote.textContent = 'Only the guest/s listed below are included in this reservation.';
      summary.appendChild(includedNote);

      const deadline = document.createElement('div');
      deadline.className = 'reservation-deadline';
      const deadlineLabel = document.createElement('span');
      deadlineLabel.textContent = 'RSVP deadline';
      const deadlineDate = document.createElement('time');
      deadlineDate.dateTime = '2026-11-20';
      deadlineDate.textContent = 'November 20, 2026';
      deadline.append(deadlineLabel, deadlineDate);
      summary.appendChild(deadline);

      const guestSection = document.createElement('section');
      guestSection.className = 'reservation-guests';
      const guestSectionHeader = document.createElement('div');
      guestSectionHeader.className = 'reservation-guests-header';
      const guestSectionTitle = document.createElement('h3');
      guestSectionTitle.textContent = 'Confirm each guest';
      const progress = document.createElement('span');
      progress.className = 'reservation-progress';
      guestSectionHeader.append(guestSectionTitle, progress);
      guestSection.appendChild(guestSectionHeader);

      const guestList = document.createElement('div');
      guestList.className = 'reservation-guest-list';
      const answers = new Map();
      const guestKey = guest => guest.firstName.trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase() + '|' + guest.lastName.trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
      const savedResponses = new Map((Array.isArray(reservation.confirmations) ? reservation.confirmations : [])
        .map(response => [guestKey(response), response]));
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'btn';
      saveButton.textContent = 'Save My RSVP';
      saveButton.disabled = true;

      function updateProgress() {
        progress.textContent = answers.size + ' of ' + guestCount + ' answered';
        saveButton.disabled = answers.size !== guestCount;
      }

      reservation.guests.forEach((guest, index) => {
        const guestCard = document.createElement('article');
        guestCard.className = 'reservation-guest';

        const guestInfo = document.createElement('div');
        guestInfo.className = 'reservation-guest-info';
        const name = document.createElement('p');
        name.className = 'reservation-guest-name';
        name.textContent = guest.firstName + ' ' + guest.lastName;
        const answer = document.createElement('p');
        answer.className = 'reservation-answer';
        answer.textContent = 'Choose an answer.';
        const savedResponse = savedResponses.get(guestKey(guest));
        if (savedResponse && ['attending', 'not-attending'].includes(savedResponse.attendance)) {
          answers.set(index, savedResponse.attendance);
          const savedLabel = savedResponse.attendance === 'attending' ? 'Attending' : 'Not Attending';
          answer.textContent = 'RSVP submitted: ' + savedLabel +
            (savedResponse.submittedAt ? ' on ' + savedResponse.submittedAt : '') + '.';
        }
        guestInfo.append(name, answer);

        const choices = document.createElement('div');
        choices.className = 'reservation-choices';
        [['Attending', 'attending'], ['Not Attending', 'not-attending']].forEach(([label, value]) => {
          const choice = document.createElement('button');
          choice.type = 'button';
          choice.className = 'reservation-choice reservation-choice-' + value;
          choice.textContent = label;
          choice.setAttribute('aria-pressed', 'false');
          const isSavedAnswer = savedResponse && savedResponse.attendance === value;
          if (isSavedAnswer) {
            choice.classList.add('is-selected');
            choice.setAttribute('aria-pressed', 'true');
          }
          choice.addEventListener('click', () => {
            answers.set(index, value);
            choices.querySelectorAll('button').forEach(button => {
              const selected = button === choice;
              button.classList.toggle('is-selected', selected);
              button.setAttribute('aria-pressed', String(selected));
            });
            answer.textContent = label + '.';
            updateProgress();
          });
          choices.appendChild(choice);
        });

        guestCard.append(guestInfo, choices);
        guestList.appendChild(guestCard);
      });

      updateProgress();
      guestSection.appendChild(guestList);

      const saveNotice = document.createElement('p');
      saveNotice.className = 'reservation-save-notice';
      saveNotice.setAttribute('role', 'status');
      saveNotice.setAttribute('aria-live', 'polite');
      const submittedCount = [...answers.keys()].length;
      saveNotice.textContent = submittedCount === guestCount
        ? 'Your RSVP has already been submitted. You can update your answers and save again.'
        : submittedCount > 0
          ? submittedCount + ' of ' + guestCount + ' guests have already submitted an RSVP. Complete the remaining answers, then save.'
          : 'Choose an answer for each guest, then save your RSVP.';
      saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        guestList.querySelectorAll('button').forEach(button => {
          button.disabled = true;
        });
        saveNotice.textContent = 'Saving your RSVP…';
        const responses = reservation.guests.map((guest, index) => ({
          firstName: guest.firstName,
          lastName: guest.lastName,
          attendance: answers.get(index)
        }));

        try {
          const result = await saveReservation(reservation, responses);
          if (!result || !result.ok) {
            throw new Error(result && result.error ? result.error : 'Could not save your RSVP. Please try again.');
          }
          saveNotice.textContent = result.message || 'Your RSVP has been saved. Thank you!';
        } catch (error) {
          saveNotice.textContent = error.message;
          console.error('Could not save the wedding RSVP:', error);
        } finally {
          guestList.querySelectorAll('button').forEach(button => {
            button.disabled = false;
          });
          saveButton.disabled = answers.size !== guestCount;
        }
      });
      guestSection.append(saveButton, saveNotice);

      reservationResult.replaceChildren(summary, guestSection);
      reservationResult.hidden = false;
    }

    rsvpLookupForm.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(rsvpLookupForm);
      const firstName = String(data.get('firstName') || '').trim();
      const lastName = String(data.get('lastName') || '').trim();
      searchStatus.textContent = 'Searching the guest list…';
      reservationResult.hidden = true;
      submitButton.disabled = true;

      try {
        const reservation = await lookupReservation(firstName, lastName);
        if (!reservation || !reservation.ok) {
          searchStatus.textContent = reservation && reservation.error
            ? reservation.error
            : 'Could not read the guest-list response. Please try again.';
          return;
        }

        searchStatus.textContent = '';
        renderReservation(reservation, firstName, lastName);
        reservationResult.querySelector('.reservation-summary').scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } catch (error) {
        searchStatus.textContent = error.message;
        console.error('Could not look up the wedding reservation:', error);
      } finally {
        submitButton.disabled = false;
      }
    });
  }
})();
