import { Duration } from 'luxon';
import { v4 } from 'uuid';
import { Constants } from '../../../../common/typescript/constants';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';
import { ITimeEntryBase } from '../../../../common/typescript/iTimeEntry';
import { Logger } from '../../logger';

export class TimeEntriesHelper {
  public static getPausesFrom(docs: ITimeEntryBase[]) : ITimeEntryBase[] {
    const pauses: ITimeEntryBase[] = [];
    const docsLength = docs.length;
    docs.forEach((currentDoc, currentIndex) => {
      if (currentIndex < docsLength - 1) {
        // it is not the last doc!
        const nextDoc = docs[currentIndex + 1];
        const theEndOfInterval = nextDoc.startTime;
        const theStartOfInterval = currentDoc.endTime;
        if (typeof theStartOfInterval === 'undefined') {
          Logger.instance.error('no endTime for pauses calculation:' + JSON.stringify(currentDoc, null, 4));
          return;
        }
        const durationInMillis = theEndOfInterval.getTime() - theStartOfInterval.getTime();
        let duration = Duration.fromMillis(durationInMillis);
        duration = duration.shiftTo(...Constants.shiftToParameter);
        pauses.push({
          startTime: theStartOfInterval,
          endTime: theEndOfInterval,
          timeEntryId: v4(),
          day: DurationCalculator.getDayFrom(theStartOfInterval),
          durationInMilliseconds: duration.toObject(),
        });
      }
    });
    return pauses;
  }
}
