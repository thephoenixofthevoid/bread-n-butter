import { failure, success } from "./Context";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";
import { ManyParsers, toParser } from "./bread-n-butter";

/** Parse all items, returning their values in the same order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any


export function all<A extends any[]>(...parsers: ManyParsers<A>): Parser<A> {
  parsers = parsers.map(toParser) as ManyParsers<A>;
  return new Parser((context) => {
    var report = failure<any>(context, []);
    const values = new Array(parsers.length) as A;

    for (let i = 0; i < parsers.length; i++) {
      const parser: ManyParsers<A>[typeof i] = parsers[i];
      const next = parser.action(context);

      context = context.moveTo(next.location);
      report = report.update(next);

      if (next.type === ActionResultType.OK) {
        values[i] = next.value;
      } else {
        return report;
      }
    }

    return report.update(success(context, values));
  });
}
