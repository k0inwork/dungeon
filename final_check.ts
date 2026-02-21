import { forthService } from './src/services/WaForthService';
import { HIVE_KERNEL_BLOCKS } from './src/kernels/HiveKernel';

async function check() {
    const proc = await forthService.bootProcess("HIVE_FINAL");
    for (const b of HIVE_KERNEL_BLOCKS) {
        try {
            proc.run(b);
        } catch(e) {
            console.error("FAIL on block:", b.substring(0, 100));
        }
    }
    console.log("Check GET_HIVE_PTR:", proc.isWordDefined("GET_HIVE_PTR"));
    console.log("Check INIT_HIVE:", proc.isWordDefined("INIT_HIVE"));
    console.log("Check INIT_HIVE_LOGIC:", proc.isWordDefined("INIT_HIVE_LOGIC"));
}
check().catch(console.error);
