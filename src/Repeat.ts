import { failure, success } from "./Context";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";
import { validateInfiniteLoop } from "./bread-n-butter";


export function Repeat<A>(itemParser: Parser<A>, min: number, max: number): Parser<A[]> {
  return new Parser(function (context) {

    var report = failure<any>(context, []);
    var values: A[] = [];

    while (values.length < max) {
      const temp = itemParser.action(context);
      report = report.update(temp);
      if (report.type !== ActionResultType.OK)
        break;
      validateInfiniteLoop(context, report);
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
