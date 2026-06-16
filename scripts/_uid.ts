import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
async function run(){const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const u=await p.user.findUnique({where:{email:"student@satway.uz"},select:{id:true,plan:true,premiumUntil:true}});
console.log(JSON.stringify(u));await p.$disconnect();}
run();
