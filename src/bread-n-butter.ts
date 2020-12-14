import { ActionResult } from "./ActionResult";
import { Context, failure, success } from "./Context";
import type { ParseNode, SourceLocation, } from "./interfaces";
import { ActionResultType } from "./interfaces";
import { Parser } from "./Parser";
import { all } from "./all";
import { choice } from "./choice";

export { ParseNode, SourceLocation, all, choice }
export type { Parser } from "./Parser";

export function validateInfiniteLoop<A>(context: Context, result: ActionResult<A>) {
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
export type ManyParsers<A extends any[]> = {
  [P in keyof A]: Parser<A[P]> | A[P];
};


export function toParser(parser: string | RegExp | Parser<any>) {
  if (typeof parser === "string") return text(parser)
  if (parser instanceof RegExp) return match(parser)
  return parser
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