const _ = require('lodash');
const moment = require('moment');

const today = moment().format('YYYY-MM-DD');
const now = moment();

const findAllTermineWithEnddateAfterNow = termine => _.filter(termine, termin =>
  moment(termin.end).isSameOrAfter(now));

const findNextFreeTimeSlot = (termine) => {
  let freeStartTime;
  // find all meetings with Enddate after now
  const meetingsEndingAfterNow = findAllTermineWithEnddateAfterNow(termine);
  // check if array is empty and return now
  if (typeof meetingsEndingAfterNow[0] === 'undefined') {
    return moment();
  }
  // sort meetings by start time
  const sortedMeetingsEndingAfterNow = _.sortBy(meetingsEndingAfterNow, 'start');
  if (sortedMeetingsEndingAfterNow.length === 1) return moment(sortedMeetingsEndingAfterNow[0].end);
  // iterate through meetings and find first open time slot
  if (moment(sortedMeetingsEndingAfterNow[0].start).isAfter(moment())) {
    freeStartTime = moment();
  } else {
    for (let i = 0; i < sortedMeetingsEndingAfterNow.length - 1; i += 1) {
      // if (nextMeeting startTime > firstMeeting endtime + 5min? ) =>
      // nextFreeMeetingTime -> firstMeeting endtime + 5min TODO
      if (moment(sortedMeetingsEndingAfterNow[i].end)
      .isBefore(sortedMeetingsEndingAfterNow[i + 1].start)) {
        freeStartTime = moment(sortedMeetingsEndingAfterNow[i].end);
        break;
      }
      // set as a default to the end of the second termin if there is no gap between
      // the start of second termin and end of first termin
      freeStartTime = moment(sortedMeetingsEndingAfterNow[i + 1].end);
      // check if meeting time is after end of work day -> if yes find next day ...
      // else send proposal to customer
      // more important stuff weekends .. hollidays ...
    }
  }
  return freeStartTime;
};

module.exports = {
  findAllTermineWithEnddateAfterNow,
  findNextFreeTimeSlot,
};
