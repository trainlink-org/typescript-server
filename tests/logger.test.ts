import { LogLevel, log } from '@/src/logger';
const consoleSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

test('Default values', () => {
    consoleSpy.mockClear();
    log('Test');
    expect(consoleSpy.mock.calls[0][0]).toBe('Test');
});

test('Warning', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    consoleSpy.mockClear();
    log('Test', LogLevel.Warning);
    expect(consoleSpy.mock.calls[0][0]).toBe('Warning: Test');
});

test('Error', () => {
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
    log('Test', LogLevel.Error);
    expect(consoleSpy.mock.calls[0]).toBe(undefined);
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('Error: Test');
});

test('Always show', () => {
    consoleSpy.mockClear();
    log('Test', LogLevel.Info, true);
    expect(consoleSpy.mock.calls[0][0]).toBe('Test');
});
