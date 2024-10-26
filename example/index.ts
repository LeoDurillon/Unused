import { $ } from "bun";
import { checkIsUsed } from "../lib/lib";
import { object } from "./imported/imported";
import { localObj } from "./localImport";

object;
localObj;
$;
checkIsUsed;
