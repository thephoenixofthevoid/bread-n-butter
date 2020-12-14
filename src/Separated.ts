import { failure, success } from "./Context";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";
import { toParser } from "./bread-n-butter";


export function Separated<A, B>(itemParser: Parser<A>, sepParser: Parser<B>, min: number, max: number): Parser<A[]> {
  itemParser = toParser(itemParser);
  sepParser = toParser(sepParser);
  const pairParser = sepParser.next(itemParser);

  return new Parser(function (context) {
    var report = failure<any>(context, []);
    var values: A[] = [];

    while (values.length < max) {
      if (values.length > 0) {
        report = report.update(pairParser.action(context));
      } else {
        report = report.update(itemParser.action(context));
      }
      if (report.type !== ActionResultType.OK)
        break;
      context = context.moveTo(report.location);
      values.push(report.value);
    }
    if (values.length < min) {
      return report.update(failure(context, []));
    } else {
      return report.update(success(context, values));
    }
  });
}
