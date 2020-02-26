/*********************************************************************
 * Copyright (c) 2019 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/

import { CLASSES } from '../..';
import { e2eContainer } from '../../inversify.config';
import { PreferencesHandler } from '../../utils/PreferencesHandler';

// const driverHelper: DriverHelper = e2eContainer.get(CLASSES.DriverHelper);
// const loginPage: ICheLoginPage = e2eContainer.get<ICheLoginPage>(TYPES.CheLogin);
const pref : PreferencesHandler = e2eContainer.get(CLASSES.PreferencesHandler);

suite('Login test', async () => {
    test('Login', async () => {
        pref.setConfirmExit(false);
        pref.setTerminalType('blabla');

        // await driverHelper.navigateToUrl(TestConstants.TS_SELENIUM_BASE_URL);
        // await loginPage.login();
    });
});
