import { ActionResult } from "./ActionResult";
import { Context, failure, success } from "./Context";
import type { ParseNode, SourceLocation, } from "./interfaces";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";
export { ParseNode, SourceLocation }

export function Separated<A, B>(itemParser: Parser<A>, sepParser: Parser<B>, min: number, max: number): Parser<A[]> {
  itemParser = toParser(itemParser)
  sepParser = toParser(sepParser)
  const pairParser = sepParser.next(itemParser)

  return new Parser(function (context) {
    var report = failure<any>(context, [])
    var values: A[] = [];

    while (values.length < max) {
      if (values.length > 0) {
        report = report.update(pairParser.action(context))
      } else {
        report = report.update(itemParser.action(context))
      }
      if (report.type !== ActionResultType.OK) break;
      context = context.moveTo(report.location)
      values.push(report.value)
    }
    if (values.length < min) {
      return report.update(failure(context, []))
    } else {
      return report.update(success(context, values))
    }
  })
}



export function Repeat<A>(itemParser: Parser<A>, min: number, max: number): Parser<A[]> {
  return new Parser(function (context) {

    var report = failure<any>(context, [])
    var values: A[] = [];

    while (values.length < max) {
      const temp = itemParser.action(context)
      report = report.update(temp)
      if (report.type !== ActionResultType.OK) break;
      validateInfiniteLoop(context, report);
      context = context.moveTo(report.location)
      values.push(report.value)
    }

    if (values.length < min) {
      return report.update(failure(context, []))
    } else {
      return report.update(success(context, values))
    }
  })
}

function validateInfiniteLoop<A>(context: Context, result: ActionResult<A>) {
  if (result.location.index === context.location.index) {
    throw new Error(
      "infinite loop detected; don't call .repeat() with parsers that can accept zero characters"
    );
  }
}

export function isRangeValid(min: number, max: number): boolean {
  return (
    min <= max &&
    min >= 0 &&
    max >= 0 &&
    Number.isInteger(min) &&
    min !== Infinity &&
    (Number.isInteger(max) || max === Infinity)
  );
}

/**
 * Parser that yields the current `SourceLocation`, containing properties
 * `index`, `line` and `column`.
 */
export const location = new Parser<SourceLocation>((context) => {
  return success(context, context.location);
});

/**
 * Returns a parser that yields the given value and consumes no input.
 */
export function ok<A>(value: A): Parser<A> {
  return new Parser(context => success(context, value));
}

/**
 * Returns a parser that fails with the given messages and consumes no input.
 */
export function fail<A>(expected: string[]): Parser<A> {
  return new Parser(context => failure(context, expected));
}

/**
 * This parser succeeds if the input has already been fully parsed.
 */
export const eof = new Parser<"<EOF>">((context) => {
  if (context.location.index < context.input.length) {
    return failure(context, ["<EOF>"]);
  } else {
    return success(context, "<EOF>");
  }
});

/** Returns a parser that matches the exact text supplied. */
export function text<A extends string>(string: A): Parser<A> {
  return new Parser<A>((context) => {
    const start = context.location.index;
    const end = start + string.length;

    if (context.input.slice(start, end) === string) {
      return success(context.moveTo(end), string);
    } else {
      return failure(context, [string]);
    }
  });
}


export function lookahead<B>(parser: Parser<B>) {
  return new Parser(function (context) {
    const a = parser.action(context)
    if (a.type !== ActionResultType.OK) {
      return a
    }
    return a.update(success(context, a.value))
  })
}

export function notFollowing<B>(parser: Parser<B>) {
  return new Parser(function (context) {
    const a = parser.action(context)
    if (a.type === ActionResultType.OK) {
      const b = failure<null>(context, [`not '${a.value}'`])
      return a.update(b)
    }
    return a.update(success(context, null))
  })
}

/**
 * Returns a parser that matches the entire regular expression at the current
 * parser position.
 */
export function match(regexp: RegExp): Parser<string> {
  for (const flag of regexp.flags) {
    switch (flag) {
      case "i": // ignoreCase
      case "s": // dotAll
      case "m": // multiline
      case "u": // unicode
        continue;
      default:
        throw new Error("only the regexp flags 'imsu' are supported");
    }
  }
  const sticky = new RegExp(regexp.source, regexp.flags + "y");
  return new Parser((context) => {
    const start = context.location.index;
    sticky.lastIndex = start;
    const match = context.input.match(sticky);
    if (match) {
      const end = start + match[0].length;
      const string = context.input.slice(start, end);
      context = context.moveTo(end)
      return success(context, string);
    }
    return failure(context, [String(regexp)]);
  });
}

/** A tuple of parsers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ManyParsers<A extends any[]> = {
  [P in keyof A]: Parser<A[P]> | A[P];
};


export function toParser(parser: string | RegExp | Parser<any>) {
  if (typeof parser === "string") return text(parser)
  if (parser instanceof RegExp) return match(parser)
  return parser
}


/** Parse all items, returning their values in the same order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function all<A extends any[]>(...parsers: ManyParsers<A>): Parser<A> {
  parsers = parsers.map(toParser) as ManyParsers<A>;
  return new Parser((context) => {
    var report = failure<any>(context, [])
    const values = new Array(parsers.length) as A;

    for (let i = 0; i < parsers.length; i++) {
      const parser: ManyParsers<A>[typeof i] = parsers[i];
      const next = parser.action(context);

      context = context.moveTo(next.location);
      report = report.update(next)

      if (next.type === ActionResultType.OK) {
        values[i] = next.value
      } else {
        return report
      }
    }

    return report.update(success(context, values))
  });
}

/** Parse using the parsers given, returning the first one that succeeds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function choice<Parsers extends (Parser<any> | any)[]>(...parsers: Parsers): Parser<ReturnType<Parsers[number]["tryParse"]>> {
  parsers = parsers.map(toParser) as Parsers;

  return new Parser((context) => {
    var report = failure<any>(context, [])

    for (let i = 0; i < parsers.length; i++) {
      const parser = parsers[i];
      const next = parser.action(context);
      report = report.update(next)
      if (next.type === ActionResultType.OK) {
        break
      }
    }

    return report
  });
}

/**
 * Takes a lazily invoked callback that returns a parser, so you can create
 * recursive parsers.
 */
export function lazy<A>(fn: () => Parser<A>): Parser<A> {
  return new Parser(function (this: Parser<A>, context) {
    this.action = fn().action;
    return this.action(context);
  });
}