import { ISummarizedTimeEntries } from '../../../../common/typescript/iSummarizedTimeEntries';
import { IBookingDeclarationsDocument } from '../../../../common/typescript/mongoDB/iBookingDeclarationsDocument';
import { ITasksDocument } from '../../../../common/typescript/mongoDB/iTasksDocument';
import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { ISummarizedTasks, ITaskLine } from '../../../../common/typescript/summarizedData';
import App from '../../app';
import taskController from '../controllers/taskController';
import timeEntriesController from '../controllers/timeEntriesController';
import { ITimeSummary } from './../../../../common/typescript/iTimeSummary';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import { MonogDbOperations } from './mongoDbOperations';
import { IStatistic } from './../../../../common/typescript/iStatistic';
import { Constants } from '../../../../common/typescript/constants';
import { Duration } from 'luxon';
import { DurationHelper } from './../../../../common/typescript/helpers/durationHelper';
import { Logger } from './../../logger';

export class CalculateDurationsByInterval {
  static async convertTimeSummaryToSummarizedTasks(input: ISummarizedTimeEntries[], mongoDbOperations: MonogDbOperations) {
    const output: ISummarizedTasks[] = [];
    for (let theOuterIndex = 0; theOuterIndex < input.length; theOuterIndex++) {
      const tasks = [];
      const oneParsedStatistics = input[theOuterIndex];
      const _timeEntryIds = oneParsedStatistics._timeEntryIds;
      const taskIds = Object.keys(oneParsedStatistics.durationSumByTaskId);

      if (!taskIds || !taskIds.length) {
        Logger.instance.error('there are no taskIds');
        continue;
      }

      for (let theInnerIndex = 0; theInnerIndex < taskIds.length; theInnerIndex++) {
        const oneTaskId = taskIds[theInnerIndex];
        const oneParsedTask: ITasksDocument[] = await taskController.getViaTaskId(oneTaskId, mongoDbOperations);
        if (oneParsedTask && oneParsedTask.length === 1) {
          tasks.push(oneParsedTask[0]);
        } else {
          Logger.instance.error('No task received');
        }
      }

      const category = oneParsedStatistics.taskCategory;
      const lines: ITaskLine[] = [];
      for (let index = 0; index < tasks.length; index++) {
        const oneTaskToMerge = tasks[index];
        const correspondingTimeEntries: ITimeEntryDocument[] = await timeEntriesController.getTimeEntriesForTaskIds([oneTaskToMerge.taskId], App.mongoDbOperations, routesConfig.isDisabledInCommit);
        const correspondingTimeEntryIds: string[] = correspondingTimeEntries.map(oneTimeEntry => oneTimeEntry.timeEntryId);
        const oneTaskToMergeId = oneTaskToMerge.taskId;
        const baseUrl = ''; // is being filled in client?
        const oneLine: ITaskLine = {
          _taskId: oneTaskToMerge.taskId,
          _timeEntryIds: correspondingTimeEntryIds,
          taskNumberUrl: baseUrl ? baseUrl + '/' + oneTaskToMerge.number : '',
          taskNumber: oneTaskToMerge.number,
          taskDescription: oneTaskToMerge.name,
          durationInHours: DurationHelper.durationToMillis(oneParsedStatistics.durationSumByTaskId[oneTaskToMergeId]) / Constants.MILLISECONDS_IN_HOUR,
          durationFraction: DurationHelper.durationToMillis(oneParsedStatistics.durationSumFractionByTaskId[oneTaskToMergeId]),
        };
        lines.push(oneLine);
      }
      const durationSum = DurationHelper.durationToMillis(oneParsedStatistics.overallDurationSum) / Constants.MILLISECONDS_IN_HOUR;
      const durationFraction = oneParsedStatistics.overallDurationSumFraction;

      output.push({
        _timeEntryIds,
        category,
        lines,
        durationSum,
        durationFraction,
      });

    }
    return output;
  }

  static async getTimeEntriesByTaskCategory(timeEntryDocsByInterval: ITimeEntryDocument[], groupCategorySelection: string | null) {
    const timeEntriesByCategory: { [category: string]: ITimeEntryDocument[] } = {};
    for (const oneTimeEntryDoc of timeEntryDocsByInterval) {
      const oneTaskId = oneTimeEntryDoc._taskId;

      const correspondingTasks: ITasksDocument[] = await taskController.getViaTaskId(oneTaskId, App.mongoDbOperations);
      if (!correspondingTasks ||
        !correspondingTasks.length ||
        correspondingTasks.length !== 1) {
        Logger.instance.error('cannot get task to read data from:');
        continue;
      }
      const singleCorrespondingTask = correspondingTasks[0];
      const groupCategory = singleCorrespondingTask.groupCategory;
      if (groupCategory !== groupCategorySelection) {
        // DEBUGGING:
        // Logger.instance.info('skipping time entry as:' + groupCategory + '!==' + groupCategorySelection);
        continue;
      }

      const taskCategory = singleCorrespondingTask.taskCategory;
      if (!timeEntriesByCategory[taskCategory]) {
        timeEntriesByCategory[taskCategory] = [];
      }
      timeEntriesByCategory[taskCategory].push(oneTimeEntryDoc);
    }
    return timeEntriesByCategory;
  }

  private static async getByBookingDeclaration(timeEntryDocsByInterval: ITimeEntryDocument[]) {
    const outputBuffer: IStatistic[] = [];

    if (!timeEntryDocsByInterval ||
      !timeEntryDocsByInterval.length) {
      Logger.instance.error('cannot use empty time entries');
      return;
    }
    const mapByBookingDeclarationId: { [bookingDeclarationId: string]: ITimeEntryDocument[] } = {};

    for (const oneTimeEntry of timeEntryDocsByInterval) {
      const bookingDeclarationId = oneTimeEntry._bookingDeclarationId;

      if (!mapByBookingDeclarationId[bookingDeclarationId]) {
        mapByBookingDeclarationId[bookingDeclarationId] = [];
      }
      mapByBookingDeclarationId[bookingDeclarationId].push(oneTimeEntry);
    }

    let overallDurationSumInMilliseconds = Duration.fromMillis(0);
    for (const _bookingDeclarationId in mapByBookingDeclarationId) {
      if (Object.prototype.hasOwnProperty.call(mapByBookingDeclarationId, _bookingDeclarationId)) {
        const oneBufferOfTimeEntries = mapByBookingDeclarationId[_bookingDeclarationId];
        if (!oneBufferOfTimeEntries ||
          !oneBufferOfTimeEntries.length) {
          Logger.instance.error('empty buffer -> continue');
          continue;
        }
        let durationInMilliseconds = Duration.fromMillis(0);
        for (const oneTimeEntry of oneBufferOfTimeEntries) {
          const durationInMillisecondsFromTimeEntry = oneTimeEntry.durationInMilliseconds;
          if (typeof durationInMillisecondsFromTimeEntry === 'undefined') {
            Logger.instance.error('no durationInMillisecondsFromTimeEntry:' + JSON.stringify(oneTimeEntry, null, 4));
            continue;
          }
          const oneDuration = Duration.fromObject(durationInMillisecondsFromTimeEntry);
          durationInMilliseconds = durationInMilliseconds.plus(oneDuration);
          overallDurationSumInMilliseconds = overallDurationSumInMilliseconds.plus(oneDuration);
        }

        const bookingsPromise = timeEntriesController.getBooking(_bookingDeclarationId, App.mongoDbOperations);
        const bookingDocs = await bookingsPromise;
        if (!bookingDocs ||
          !bookingDocs.length ||
          bookingDocs.length > 1) {
          Logger.instance.error('no corresponding booking found -> continue');
          continue;
        }
        const oneBookingDoc: IBookingDeclarationsDocument = bookingDocs[0];
        const code = oneBookingDoc.code;
        const description = oneBookingDoc.description;
        const durationInHours = DurationHelper.durationToMillis(durationInMilliseconds) / Constants.MILLISECONDS_IN_HOUR;

        outputBuffer.push({
          description: description,
          identifier: code,
          identifierUrl: '',
          durationFraction: 0.0,
          durationInHours: durationInHours,
          uniqueId: _bookingDeclarationId,
          _timeEntryIds: timeEntryDocsByInterval.map(tE => tE.timeEntryId),
        });
      }
    }
    const overallDurationInHours = DurationHelper.durationToMillis(overallDurationSumInMilliseconds) / Constants.MILLISECONDS_IN_HOUR;
    const statistics: IStatistic[] = [];
    outputBuffer.forEach((oneTemporaryBufferEntry) => {
      statistics.push({
        description: oneTemporaryBufferEntry.description,
        durationFraction: oneTemporaryBufferEntry.durationInHours / overallDurationInHours,
        durationInHours: oneTemporaryBufferEntry.durationInHours,
        identifier: oneTemporaryBufferEntry.identifier,
        identifierUrl: oneTemporaryBufferEntry.identifierUrl,
        uniqueId: oneTemporaryBufferEntry.uniqueId,
        _timeEntryIds: oneTemporaryBufferEntry._timeEntryIds,
      });
    });

    return statistics;
  }

  private static async getByGroupCategory(timeEntryDocsByInterval: ITimeEntryDocument[], groupCategorySelection: string | null): Promise<ITimeSummary | null> {
    const durationSumByTaskIdMap: { [category: string]: { [taskId: string]: Duration } } = {};
    const durationSumFractionByTaskIdMap: { [category: string]: { [taskId: string]: Duration } } = {};
    const oneTimeEntryBufferByGroupCategory = await this.getTimeEntriesByTaskCategory(timeEntryDocsByInterval, groupCategorySelection);

    // DEBUGGING:
    // Logger.instance.info(JSON.stringify(timeEntriesByCategory, null, 4));

    let durationSumOverAllCategories = Duration.fromMillis(0);
    const timeSummaryMap: ITimeSummary = {};
    if (!groupCategorySelection) {
      Logger.instance.error('cannot get time entries by group category as groupCategory:' + groupCategorySelection);
      return null;
    }

    // DEBUGGING:
    // Logger.instance.info(JSON.stringify(oneTimeEntryBufferByGroupCategory, null, 4));

    for (const taskCategory in oneTimeEntryBufferByGroupCategory) {
      if (!durationSumByTaskIdMap[taskCategory]) {
        durationSumByTaskIdMap[taskCategory] = {};
      }
      if (!durationSumFractionByTaskIdMap[taskCategory]) {
        durationSumFractionByTaskIdMap[taskCategory] = {};
      }
      if (Object.prototype.hasOwnProperty.call(oneTimeEntryBufferByGroupCategory, taskCategory)) {
        const timeEntriesOfOneCategory: ITimeEntryDocument[] = oneTimeEntryBufferByGroupCategory[taskCategory];

        // DEBUGGING:
        // Logger.instance.info(JSON.stringify(timeEntriesOfOneCategory));

        const oneTimeEntryIds: string[] = [];
        let oneOverallSum = Duration.fromMillis(0);
        for (const oneTimeEntry of timeEntriesOfOneCategory) {
          // const oneDuration = oneTimeEntry.durationInMilliseconds;
          const durInMilis = oneTimeEntry.durationInMilliseconds;
          if(typeof durInMilis === 'undefined') {
            Logger.instance.error('no durInMillis:' + JSON.stringify(oneTimeEntry, null, 4));
            continue;
          }
          const singleDuration = Duration.fromObject(durInMilis);
          const taskId = oneTimeEntry._taskId;

          // necessary: the timeEntries could be disabled by either booking or commit...
          if (!durationSumByTaskIdMap[taskCategory][taskId]) {
            durationSumByTaskIdMap[taskCategory][taskId] = Duration.fromMillis(0);
          }
          durationSumByTaskIdMap[taskCategory][taskId] = durationSumByTaskIdMap[taskCategory][taskId].plus(singleDuration);

          oneOverallSum = oneOverallSum.plus(singleDuration);
          oneTimeEntryIds.push(oneTimeEntry.timeEntryId);
        }

        timeSummaryMap[taskCategory] = {
          taskCategory: taskCategory,
          overallDurationSum: oneOverallSum,
          overallDurationSumFraction: 0.0,
          _timeEntryIds: oneTimeEntryIds,
          durationSumByTaskId: durationSumByTaskIdMap[taskCategory],
          durationSumFractionByTaskId: durationSumFractionByTaskIdMap[taskCategory],
        };
        durationSumOverAllCategories = durationSumOverAllCategories.plus(oneOverallSum);
      }
    }

    for (const taskCategory in durationSumByTaskIdMap) {
      if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap, taskCategory)) {
        for (const taskId in durationSumByTaskIdMap[taskCategory]) {
          if (Object.prototype.hasOwnProperty.call(durationSumByTaskIdMap[taskCategory], taskId)) {
            const absolutedurationSumByTaskId = durationSumByTaskIdMap[taskCategory][taskId];
            durationSumFractionByTaskIdMap[taskCategory][taskId] = Duration.fromMillis(DurationHelper.durationToMillis(absolutedurationSumByTaskId) / DurationHelper.durationToMillis(durationSumOverAllCategories));

            // convert to hours:
            // durationSumByTaskIdMap[taskCategory][taskId] = absolutedurationSumByTaskId;
          }
        }
      }
    }

    // DEBUGGING:
    // Logger.instance.info(JSON.stringify(categoryBufferMap, null, 4));
    for (const oneTaskCat in timeSummaryMap) {
      if (Object.prototype.hasOwnProperty.call(timeSummaryMap, oneTaskCat)) {
        const sumEntry = timeSummaryMap[oneTaskCat];
        sumEntry.overallDurationSumFraction = DurationHelper.durationToMillis(sumEntry.overallDurationSum) / DurationHelper.durationToMillis(durationSumOverAllCategories);

        // convert to hours:
        // timeSummaryMap[oneTaskCat].overallDurationSum = timeSummaryMap[oneTaskCat].overallDurationSum / Constants.HOURS_IN_MILLISECONDS;
      }
    }

    // DEBUGGING:
    // Logger.instance.info(JSON.stringify(categoryBufferMap, null, 4));

    return timeSummaryMap;
  }

  static async calculate(startTime: Date, endTime: Date, isBookingBased: boolean, groupCategory: string | null, isDisabledPropertyName?: string, isDisabledPropertyValue?: boolean) {
    try {
      // DEBUGGING:
      // Logger.instance.info(startTime.toUTCString());
      // Logger.instance.info(endTime.toUTCString());

      const timeEntryDocsByInterval: ITimeEntryDocument[] = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTime, endTime, isDisabledPropertyName, isDisabledPropertyValue);
      if (!timeEntryDocsByInterval || !timeEntryDocsByInterval.length) {
        Logger.instance.error('no time entries to calculate duration from');
        return null;
      }
      if (!isBookingBased) {
        return CalculateDurationsByInterval.getByGroupCategory(timeEntryDocsByInterval, groupCategory);
      } else {
        return CalculateDurationsByInterval.getByBookingDeclaration(timeEntryDocsByInterval);
      }
    }
    catch (e) {
      Logger.instance.error('outer exception:');
      Logger.instance.error(e);
      Logger.instance.error(JSON.stringify(e, null, 4));
      return e;
    }
  }

  static async getTimeInterval() {

  }
}
