import { ActionResult, ActionResultType, SourceLocation } from "./interfaces";

// export function initialReport(location: SourceLocation): ActionResult<any>  {
//     return {
//         type: ActionResultType.Fail,
//         furthest: location,
//         location: location,
//         expected: [],
//     }
// }


/**
 * Represents the current parsing context.
 */
export class Context {

    constructor(
        public input: string,
        public location: SourceLocation
    ) { 
    }

    /**
     * Returns a new context with the supplied location and the current input.
     */
    moveTo(location: SourceLocation | number): Context {
        if (typeof location === "number") {
            return new Context(this.input, this._internal_move(location) );
        } else {
            return new Context(this.input, location);
        }
    }

    private _internal_move(newIndex: number): SourceLocation {
        var { index, line, column } = this.location;

        while (index < newIndex) {
            const ch = this.input[index++];
            column++;
            if (ch === "\n") {
                line++;
                column = 1;
            }
        }

        return { index, line, column };
    }
}

export function success<A>(context: Context, value: A): ActionResult<A> {
    return {
        type: ActionResultType.OK,
        value,
        location: context.location,
        furthest: { index: -1, line: -1, column: -1 },
        expected: [],
    }
}

export function failure<A>(context: Context, expected: string[]): ActionResult<A> {
    return {
        type: ActionResultType.Fail,
        value: undefined,
        furthest: context.location,
        location: context.location,
        expected,
    };
}


/**
* Merge two sequential `ActionResult`s so that the `expected` and location data
* is preserved correctly.
*/
export function merge<A, B>(a: ActionResult<A>, b: ActionResult<B>): ActionResult<B> {
    if (a.furthest.index > b.furthest.index) return {
        ...b, expected: a.expected, furthest: a.furthest
    };

    if (a.furthest.index < b.furthest.index) return {
        ...b, expected: b.expected, furthest: b.furthest
    };

    const expected = [...new Set([...a.expected, ...b.expected])]
    return {
        ...b, expected: expected, furthest: a.furthest
    };
}