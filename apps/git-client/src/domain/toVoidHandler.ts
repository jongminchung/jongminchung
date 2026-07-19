export function toVoidHandler<Arguments extends unknown[]>(
    handler: (...arguments_: Arguments) => Promise<unknown>,
): (...arguments_: Arguments) => void {
    return (...arguments_) => {
        void handler(...arguments_);
    };
}
