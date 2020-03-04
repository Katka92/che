import { e2eContainer } from '../../inversify.config';
import { DriverHelper } from '../../utils/DriverHelper';
import { CLASSES, TYPES } from '../../inversify.types';
import { ICheLoginPage } from '../../pageobjects/login/ICheLoginPage';
import { Ide } from '../../pageobjects/ide/Ide';

const driverHelper : DriverHelper = e2eContainer.get(CLASSES.DriverHelper);
const loginPage : ICheLoginPage = e2eContainer.get(TYPES.CheLogin);
const ide : Ide = e2eContainer.get(CLASSES.Ide);

suite ('Preset environment', async() => {
    test('Login', async() => {
        await driverHelper.navigateToUrl(`http://che-katka.apps.ocp43.codereadyqe.com/dashboard/#/ide/user1/java-web-vertx-m6i18`);
        await loginPage.login();
    });

    test('Wait workspace in running state', async () => {
        await ide.waitWorkspaceAndIde('user1', `java-web-vertx-m6i18`);
        // wait for README to be opened
        await new Promise ((res) => setTimeout(res , 9000));
    });
});

