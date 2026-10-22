import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AppStateLifecycle } from '@/infrastructure/sync/AppStateLifecycle';
import { NetInfoConnectivity } from '@/infrastructure/sync/NetInfoConnectivity';
import { SystemTimer } from '@/infrastructure/sync/SystemTimer';

type NetListener = (state: { isConnected: boolean | null }) => void;

describe('NetInfoConnectivity', () => {
  let listener: NetListener;
  const unsubscribe = jest.fn();
  beforeEach(() => {
    unsubscribe.mockClear();
    (NetInfo.addEventListener as jest.Mock).mockClear();
    (NetInfo.addEventListener as jest.Mock).mockImplementation(
      (l: NetListener) => {
        listener = l;
        return unsubscribe;
      },
    );
  });

  it('is optimistic until NetInfo reports, then follows isConnected', () => {
    const c = new NetInfoConnectivity();
    expect(NetInfo.addEventListener).not.toHaveBeenCalled();
    expect(c.isOnline()).toBe(true);
    listener({ isConnected: false });
    expect(c.isOnline()).toBe(false);
    listener({ isConnected: true });
    expect(c.isOnline()).toBe(true);
  });

  it('treats an unknown (null) state as online and ignores reachability probes', () => {
    const c = new NetInfoConnectivity();
    c.isOnline();
    listener({ isConnected: null });
    expect(c.isOnline()).toBe(true);
  });

  it('tells subscribers only about changes and stops after unsubscribe', () => {
    const c = new NetInfoConnectivity();
    const seen: boolean[] = [];
    const off = c.subscribe(online => seen.push(online));
    listener({ isConnected: true });
    listener({ isConnected: false });
    listener({ isConnected: false });
    listener({ isConnected: true });
    expect(seen).toEqual([false, true]);
    off();
    listener({ isConnected: false });
    expect(seen).toEqual([false, true]);
  });

  it('dispose() removes the NetInfo listener', () => {
    const c = new NetInfoConnectivity();
    c.isOnline();
    c.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('AppStateLifecycle', () => {
  it('reports foreground from the app state and notifies on change', () => {
    const remove = jest.fn();
    let handler!: (state: string) => void;
    const add = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, h) => {
        handler = h as (state: string) => void;
        return { remove } as never;
      });
    const move = (state: string) => {
      Object.defineProperty(AppState, 'currentState', {
        value: state,
        configurable: true,
      });
      handler(state);
    };
    const lifecycle = new AppStateLifecycle();
    const seen: boolean[] = [];
    const off = lifecycle.subscribe(f => seen.push(f));
    move('background');
    expect(lifecycle.isForeground()).toBe(false);
    move('background');
    move('active');
    expect(lifecycle.isForeground()).toBe(true);
    expect(seen).toEqual([false, true]);
    off();
    expect(remove).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });
});

describe('SystemTimer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs once after the delay and can be cancelled', () => {
    const timer = new SystemTimer();
    const fn = jest.fn();
    timer.schedule(fn, 1000);
    jest.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    const cancelled = jest.fn();
    timer.schedule(cancelled, 1000)();
    jest.advanceTimersByTime(5000);
    expect(cancelled).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
