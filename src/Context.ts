import { ActionResult } from "./ActionResult";
import { ActionResultType, SourceLocation } from "./interfaces";

export class Context {

    constructor(
        public input: string,
        public location: SourceLocation = { index: 0, line: 1, column: 1 }
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
    return new ActionResult({
        type: ActionResultType.OK,
        value,
        location: context.location,
        furthest: { index: -1, line: -1, column: -1 },
        expected: [],
    })
}

export function failure<A>(context: Context, expected: string[]): ActionResult<A> {
    return new ActionResult({
        type: ActionResultType.Fail,
        furthest: context.location,
        location: context.location,
        expected,
    })
}