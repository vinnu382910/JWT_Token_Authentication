const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1);
  }
}

initializeDBAndServer()

//Authentocation

const authentocationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'jhjhbbj', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//User Login API

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatch) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'jhjhbbj')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Get list of all states in state table

const convertToResObj = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

app.get('/states/', authentocationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`
  const statesArrays = await db.all(getStatesQuery)
  response.send(statesArrays.map(eachObj => convertToResObj(eachObj)))
})

//GET state by stateId

app.get('/states/:stateId/', authentocationToken, async (request, response) => {
  const {stateId} = request.params
  const getStateByIDQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`
  const state = await db.get(getStateByIDQuery)
  response.send(convertToResObj(state))
})

// Post district in district table

app.post('/districts/', authentocationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistQuery = ` INSERT INTO district (district_name, state_id, cases, cured, active, deaths) 
  VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`
  await db.run(addDistQuery)
  response.send('District Successfully Added')
})

//Get District By districtId

const converDistResObj = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

app.get(
  '/districts/:districtId/',
  authentocationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
    const dist = await db.get(getDistQuery)
    response.send(converDistResObj(dist))
  },
)

// Delete a dist by dist Id

app.delete(
  '/districts/:districtId/',
  authentocationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistQuery = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(deleteDistQuery)
    response.send('District Removed')
  },
)

// Updates the details of a specific district based on the district ID

app.put(
  '/districts/:districtId/',
  authentocationToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtdetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtdetails
    const updateQuery = `
            UPDATE district 
            SET 
                district_name='${districtName}',
                state_id=${stateId},
                cases=${cases},
                cured=${cured},
                active=${active},
                deaths=${deaths}
            WHERE district_id=${districtId};`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

//Get the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  '/states/:stateId/stats/',
  authentocationToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatsOfstateQuery = `
  SELECT SUM(cases), SUM(cured), SUM(active), SUM(deaths) FROM district WHERE state_id = ${stateId};`
    const stats = await db.get(getStatsOfstateQuery)
    console.log(stats)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
