import { failure } from "./Context";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";
import { toParser } from "./bread-n-butter";

/** Parse using the parsers given, returning the first one that succeeds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any


export function choice<Parsers extends (Parser<any> | any)[]>(...parsers: Parsers): Parser<ReturnType<Parsers[number]["tryParse"]>> {
  parsers = parsers.map(toParser) as Parsers;

  return new Parser((context) => {
    var report = failure<any>(context, []);

    for (let i = 0; i < parsers.length; i++) {
      const next = parsers[i].action(context);
      report = report.update(next);
      if (next.type === ActionResultType.OK) {
        break;
      }
    }

    return report;
  });
}
