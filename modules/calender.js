const _ = require('lodash');
const moment = require('moment');

const today = moment().format('YYYY-MM-DD');
const now = moment();

const findTodaysCalenderEntry = nonAvailablility => nonAvailablility.today;

const findAllTermineWithEnddateAfterNow = termine => _.filter(termine, termin =>
  moment(termin.end).isSameOrAfter(now));

const findNextFreeTimeSlot = (termine) => {
  let freeStartTime;
  // find all meetings with Enddate after now
  const meetingsEndingAfterNow = findAllTermineWithEnddateAfterNow(termine);
  // sort meetings by start time
  const sortedMeetingsEndingAfterNow = _.sortBy(meetingsEndingAfterNow, 'start');
  // iterate through meetings and find first open time slot
  if (moment(sortedMeetingsEndingAfterNow[0].start).isAfter(moment())) {
    freeStartTime = moment();
  } else {
    for (let i = 1; i < sortedMeetingsEndingAfterNow.length; i += 1) {
      // if (nextMeeting startTime > firstMeeting endtime + 5min? ) =>
      // nextFreeMeetingTime -> firstMeeting endtime + 5min TODO
      if (moment(sortedMeetingsEndingAfterNow[i].end)
      .isBefore(sortedMeetingsEndingAfterNow[i + 1].start)) {
        freeStartTime = moment(sortedMeetingsEndingAfterNow[i].end);
        // TODO create meeting for employee
        break;
      }
      // check if meeting time is after end of work day -> if yes find next day ...
      // else send proposal to customer
      // more important stuff weekends .. hollidays ...
    }
  }
  return freeStartTime;
};

module.exports = {
  findTodaysCalenderEntry,
  findAllTermineWithEnddateAfterNow,
  findNextFreeTimeSlot,
};
