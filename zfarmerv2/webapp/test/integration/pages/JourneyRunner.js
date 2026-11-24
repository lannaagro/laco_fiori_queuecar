sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/lannaagro/zdev/odatav2/zfarmerv2/test/integration/pages/FarmerList.gen",
	"com/lannaagro/zdev/odatav2/zfarmerv2/test/integration/pages/FarmerObjectPage.gen"
], function (JourneyRunner, FarmerListGenerated, FarmerObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/lannaagro/zdev/odatav2/zfarmerv2') + '/test/flp.html#app-preview',
        pages: {
			onTheFarmerListGenerated: FarmerListGenerated,
			onTheFarmerObjectPageGenerated: FarmerObjectPageGenerated
        },
        async: true
    });

    return runner;
});

