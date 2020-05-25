// import { HMRHelper, HMRPayload } from 'fuse-box/types/hmr'

// export default function (payload: HMRPayload, helper: HMRHelper): void {
//     const { updates } = payload
//     console.log('__HMR__', payload, helper)
//     if (helper.isStylesheeetUpdate) {
//         helper.flushModules(updates)
//         helper.updateModules()
//         helper.callModules(updates)
//     } else {
//         helper.flushAll()
//         helper.updateModules()
//         helper.callEntries()
//     }
// }

export default function (): void {
    // @ts-ignore
    window.location.reload()
}
