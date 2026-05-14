const rp = require('request-promise');
const bcrypt = require('bcryptjs');
const { loginFPLapi, getProfileFPLapi, redirectURL } = require('../api/FPLApi');

const getUserProfile = (userCredentials, ctx) => {
  const options = {
    uri: getProfileFPLapi,
    headers: {
      Cookie: userCredentials.profileID,
      'Content-Type': 'application/json'
    },
    json: true
  };

  const userProfile = () => rp(options)
    .then(async (res) => {
      const { player } = res;
      const updateUser = await ctx.prisma.updateUser({
        where: { email: player.email },
        data: {
          FPL_user_id: player.id,
          date_of_birth: player.date_of_birth,
          dirty: player.dirty,
          first_name: player.first_name,
          gender: player.gender,
          last_name: player.last_name,
          entry: player.entry,
          region: player.region
        }
      });
      const result = { ...userCredentials, ...updateUser };
      return result;
    })
    .catch((err) => {
      throw new Error(err);
    });

  return userProfile();
};

const loginToFPL = (login, password, context) => {
  const cookieJar = rp.jar();

  const options = {
    url: loginFPLapi,
    method: 'POST',
    form: {
      login,
      password,
      redirect_uri: redirectURL,
      app: 'plfpl-web'
    },
    resolveWithFullResponse: true,
    simple: false,
    jar: cookieJar
  };

  const requestLoginToFPLAPI = () => rp(options)
    .then(async (response) => {
      let result;
      if (response.headers.location.includes('success')) {
        const responseProfileID = response.headers['set-cookie'][0].match(/.+?(?=\;)/)[0];
        const hashedPassword = await bcrypt.hash(password, 2);
        const user = await context.prisma.user({ email: login });
        if (user) {
          const { email } = user;
          await context.prisma.updateUser({
            where: { email },
            data: {
              password: hashedPassword,
              profileID: responseProfileID
            }
          });
          result = {
            message: 'Existed',
            success: true,
            profileID: responseProfileID
          };
        } else {
          await context.prisma.createUser({
            email: login,
            password: hashedPassword,
            profileID: responseProfileID
          });
          result = {
            message: 'Create account on Vidigoals and login succesful',
            success: true,
            profileID: responseProfileID
          };
        }
      } else {
        result = {
          message: 'Invalid email or password',
          success: false,
          profileID: ''
        };
      }
      return result;
    })
    .catch(err => ({ message: err, success: false, profileID: '' }));

  return requestLoginToFPLAPI()
    .then(userCredentials => getUserProfile(userCredentials, context))
    .catch((err) => {
      throw new Error(err);
    });
};

const FPL = { loginToFPL };

module.exports = FPL;
