// A small seeded random number generator (mulberry32), so a seed always gives the same diagram.
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // A number from 0 up to 1.
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // A whole number from 0 up to n.
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  // A normally distributed number, with mean 0 and standard deviation 1.
  gaussian(): number {
    const u = 1 - this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
