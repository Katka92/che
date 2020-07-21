/*********************************************************************
 * Copyright (c) 2019 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/
import { injectable, inject } from 'inversify';
import { CLASSES } from '../../inversify.types';
import { DriverHelper } from '../../utils/DriverHelper';
import { By, Key, WebElement, error } from 'selenium-webdriver';
import { Logger } from '../../utils/Logger';
import { TimeoutConstants } from '../../TimeoutConstants';

@injectable()
export class Terminal {
    private static readonly TERMINAL_ROWS_XPATH_LOCATOR_PREFFIX = '(//div[contains(@class, \'terminal-container\')]//div[contains(@class, \'terminal\')]//div[contains(@class, \'xterm-rows\')])';
    constructor(@inject(CLASSES.DriverHelper) private readonly driverHelper: DriverHelper) { }

    async waitTabAbsence(tabTitle: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT) {
        Logger.debug(`Terminal.waitTabAbsence "${tabTitle}"`);

        const terminalTabLocator: By = By.css(this.getTerminalTabCssLocator(tabTitle));

        await this.driverHelper.waitDisappearanceWithTimeout(terminalTabLocator, timeout);
    }

    async clickOnTab(tabTitle: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT) {
        Logger.debug(`Terminal.clickOnTab "${tabTitle}"`);

        const terminalTabLocator: By = By.css(this.getTerminalTabCssLocator(tabTitle));

        await this, this.driverHelper.waitAndClick(terminalTabLocator, timeout);
    }

    async waitTabFocused(tabTitle: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT) {
        Logger.debug(`Terminal.waitTabFocused "${tabTitle}"`);

        const focusedTerminalTabLocator: By = this.getFocusedTerminalTabLocator(tabTitle);

        await this.driverHelper.waitVisibility(focusedTerminalTabLocator, timeout);
    }

    async selectTerminalTab(tabTitle: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT) {
        Logger.debug(`Terminal.selectTerminalTab "${tabTitle}"`);

        await this.clickOnTab(tabTitle, timeout);
        await this.waitTabFocused(tabTitle, timeout);
    }

    async clickOnTabCloseIcon(tabTitle: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT) {
        Logger.debug(`Terminal.clickOnTabCloseIcon "${tabTitle}"`);

        const terminalTabCloseIconLocator: By =
            By.css(`${this.getTerminalTabCssLocator(tabTitle)} div.p-TabBar-tabCloseIcon`);

        await this.driverHelper.waitAndClick(terminalTabCloseIconLocator, timeout);
    }

    async closeTerminalTab(tabTitle: string, timeout: number = 5_000) {
        Logger.debug(`Terminal.closeTerminalTab "${tabTitle}"`);

        await this.clickOnTabCloseIcon(tabTitle, timeout);
        await this.waitTabAbsence(tabTitle, timeout);
    }

    async type(terminalTabTitle: string, text: string) {
        Logger.debug(`Terminal.type "${terminalTabTitle}"`);

        const terminalIndex: number = await this.getTerminalIndex(terminalTabTitle);
        const terminalInteractionContainer: By = this.getTerminalEditorInteractionEditorLocator(terminalIndex);

        await this.driverHelper.typeToInvisible(terminalInteractionContainer, text);
    }

    async rejectTerminalProcess(tabTitle: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT) {
        Logger.debug(`Terminal.rejectTerminalProcess "${tabTitle}"`);

        await this.selectTerminalTab(tabTitle, timeout);
        await this.type(tabTitle, Key.chord(Key.CONTROL, 'c'));
    }

    async getText(terminalTab: string, timeout: number = TimeoutConstants.TS_SELENIUM_TERMINAL_DEFAULT_TIMEOUT): Promise<string> {
        Logger.debug(`Terminal.getText tab: ${terminalTab}`);

        const terminalIndex: number = await this.getTerminalIndex(terminalTab);
        await this.selectTerminalTab(terminalTab, timeout);
        return await this.driverHelper.waitAndGetText(By.xpath(Terminal.TERMINAL_ROWS_XPATH_LOCATOR_PREFFIX + `[${terminalIndex}]`), timeout);
    }

    async selectTabByPrefixAndWaitText(terminalTab: string, expectedText: string, timeout: number) {
        Logger.debug(`Terminal.selectTabByPrefixAndWaitText tab: ${terminalTab} text: ${expectedText}`);

        const terminalTabLocatorWithPreffix: string = `//li[contains(@title, '${terminalTab}')]`;
        const terminalIndex: number = await this.getTerminalIndex(terminalTab);

        await this.driverHelper.waitAndClick(By.xpath(terminalTabLocatorWithPreffix), timeout);
        await this.driverHelper.waitUntilTrue(async () => {
            const terminalText: string = await this.driverHelper.waitAndGetText(By.xpath(Terminal.TERMINAL_ROWS_XPATH_LOCATOR_PREFFIX + `[${terminalIndex}]`), timeout);
            return terminalText.includes(expectedText);

        }, timeout);
    }

    async waitText(terminalTab: string, expectedText: string, timeout: number) {
        Logger.debug(`Terminal.waitText tab: ${terminalTab} text: ${expectedText}`);

        await this.selectTerminalTab(terminalTab, timeout);
        await this.driverHelper.waitUntilTrue(async () => {
            const terminalText: string = await this.getText(terminalTab, timeout);
            return terminalText.includes(expectedText);

        }, timeout);
    }

    private getTerminalTabCssLocator(tabTitle: string): string {
        return `li[title='${tabTitle}']`;
    }

    private getFocusedTerminalTabLocator(tabTitle: string): By {
        return By.css(`li[title='${tabTitle}'].p-mod-current.theia-mod-active`);
    }

    private async getTerminalIndex(terminalTitle: string): Promise<number> {
        for (let i: number = 0; i < 10; i++) {
            try {
                return await this.searchTerminalIndex(terminalTitle);
            } catch (err) {
                if (!(err instanceof error.NoSuchElementError)) {
                    throw err;
                }

            }
        }

        throw new error.NoSuchElementError(`The terminal with title '${terminalTitle}' has not been found.`);
    }

    private async searchTerminalIndex(terminalTitle: string): Promise<number> {
        const terminalTabTitleXpathLocator: string = `//div[@id='theia-bottom-content-panel']` +
            `//li[contains(@id, 'shell-tab-terminal') or contains(@id, 'shell-tab-plugin')]` +
            `//div[@class='p-TabBar-tabLabel']`;

        const terminalTabs: WebElement[] = await this.driverHelper.waitAllPresence(By.xpath(terminalTabTitleXpathLocator), TimeoutConstants.TS_SELENIUM_CLICK_ON_VISIBLE_ITEM);
        let terminalTitles: string[] = [];


        for (let i: number = 1; i <= terminalTabs.length; i++) {
            const terminalTabLocator: By = By.xpath(`(${terminalTabTitleXpathLocator})[${i}]`);
            const currentTerminalTitle: string = await this.driverHelper.waitAndGetText(terminalTabLocator, TimeoutConstants.TS_SELENIUM_CLICK_ON_VISIBLE_ITEM);

            if (currentTerminalTitle.search(terminalTitle) > -1) {
                Logger.debug(`Terminal index: ${i}`);
                return i;
            }

            terminalTitles.push(currentTerminalTitle);
        }

        throw new error.NoSuchElementError(`The terminal with title '${terminalTitle}' has not been found.\n` +
            `List of the tabs:\n${terminalTitles}`);

    }

    private getTerminalEditorInteractionEditorLocator(terminalIndex: number): By {
        return By.xpath(`(//textarea[@aria-label='Terminal input'])[${terminalIndex}]`);
    }

}
