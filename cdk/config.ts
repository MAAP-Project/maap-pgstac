export class Config {
  readonly stage: string;
  readonly version: string;
  readonly terminationProtection: boolean;
  readonly tags: Record<string, string>;

  constructor() {
    this.stage = process.env.STAGE || "dev";
    this.version = process.env.npm_package_version!; // Set by node.js
    this.terminationProtection =
      !!process.env.TERMINATION_PROTECTION ||
      ["dev", "prod"].includes(this.stage);

    this.tags = {
      created_by: process.env.USER!,
      version: this.version,
      stage: this.stage,
    };
  }

  /**
   * Helper to generate id of stack
   * @param serviceId Identifier of service
   * @returns Full id of stack
   */
  buildStackName = (serviceId: string): string =>
    `MAAP-STAC-${this.stage}-${serviceId}`;
}
