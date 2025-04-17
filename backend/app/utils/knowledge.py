#环保知识库
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.data.class_map import CLASS_NAME_MAP
from app.data.action_map import ACTION_MAP

router = APIRouter()

KNOWLEDGE_BASE = {
    "可回收物": {
        "description": "可回收物是指可以循环再利用的资源，通常包括纸张、塑料、玻璃、金属等材料。回收这些物品可以减少资源浪费。",
        "examples": [],
        "handling": "清洗干净后放入可回收物垃圾桶，避免污染其他可回收物。注意不要混入不可回收的杂质。",
        "environmental_impact": "通过回收再利用，可减少对自然资源的开采，降低能源消耗，减少垃圾填埋和焚烧带来的环境污染。"
    },
    "有害垃圾": {
        "description": "有害垃圾是指对人体健康或自然环境造成直接或潜在危害的垃圾，需要特殊处理以避免污染。",
        "examples": [],
        "handling": "单独收集，放入有害垃圾桶，送至指定回收点或专业处理机构，避免随意丢弃。",
        "environmental_impact": "防止有害物质（如重金属、化学物质）渗入土壤和水源，保护生态环境和人体健康。"
    },
    "湿垃圾": {
        "description": "湿垃圾主要是指易腐烂的有机垃圾，通常为厨余垃圾，可以通过堆肥或生物降解处理。",
        "examples": [],
        "handling": "尽量沥干水分，放入湿垃圾桶，避免混入塑料袋等不可降解物，定期清理以防异味。",
        "environmental_impact": "通过堆肥或厌氧发酵可转化为有机肥或沼气，减少垃圾填埋量，促进资源循环利用。"
    },
    "干垃圾": {
        "description": "干垃圾是指除可回收物、有害垃圾和湿垃圾外的其他垃圾，通常难以回收或分解，需要妥善处理。",
        "examples": [],
        "handling": "放入干垃圾桶，妥善密封以减少异味，通常通过焚烧或填埋处理。",
        "environmental_impact": "通过规范处理可减少环境污染，但填埋或焚烧仍可能产生一定环境负担，需尽量减量。"
    }
}

# 填充 KNOWLEDGE_BASE 的 examples 字段
for en_name, cn_name in CLASS_NAME_MAP.items():
    category = cn_name.split("/")[0]
    item = cn_name.split("/")[1]
    handling = ACTION_MAP.get(en_name, "未知处理方式")
    if category in KNOWLEDGE_BASE:
        KNOWLEDGE_BASE[category]["examples"].append({
            "item": item,
            "handling": handling
        })

@router.get("/knowledge")  # 修改为 /knowledge
async def get_knowledge():
    return JSONResponse(content=KNOWLEDGE_BASE)