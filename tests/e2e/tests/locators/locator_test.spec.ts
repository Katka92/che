import { Workbench } from 'monaco-page-objects';

suite ('Test commands', async() => {
    test('Dialog About', async function () {
        let workbench : Workbench = new Workbench();
        await workbench.executeCommand('About');
    });
});

